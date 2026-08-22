//
// Copyright (C) Microsoft Corporation. All rights reserved.
//
#include "pch.h"

namespace
{
    constexpr wchar_t SHARED_FRAME_NAME[] = L"Local\\PlayStreamersVirtualCameraFrameV1";
    constexpr BYTE SHARED_FRAME_MAGIC[8] = { 'P', 'S', 'V', 'C', 'A', 'M', '1', 0 };
    constexpr UINT32 SHARED_FRAME_VERSION = 1;
    constexpr UINT32 SHARED_FRAME_HEADER_SIZE = 64;
    constexpr UINT32 SHARED_FRAME_PIXEL_FORMAT_BGRA = 1;
    constexpr UINT32 SHARED_FRAME_MAX_BYTES = 1920u * 1080u * 4u;

#pragma pack(push, 1)
    struct SharedFrameHeader
    {
        BYTE magic[8];
        UINT32 version;
        UINT32 headerSize;
        UINT32 width;
        UINT32 height;
        UINT32 stride;
        UINT32 pixelFormat;
        UINT32 frameSize;
        UINT32 reserved;
        volatile LONG64 sequence;
        ULONGLONG timestampMs;
        BYTE tail[8];
    };
#pragma pack(pop)

    static_assert(sizeof(SharedFrameHeader) == SHARED_FRAME_HEADER_SIZE);

    ULONGLONG UnixTimeMilliseconds()
    {
        FILETIME fileTime{};
        GetSystemTimeAsFileTime(&fileTime);
        ULARGE_INTEGER value{};
        value.LowPart = fileTime.dwLowDateTime;
        value.HighPart = fileTime.dwHighDateTime;
        constexpr ULONGLONG WindowsToUnixEpoch = 116444736000000000ULL;
        return value.QuadPart > WindowsToUnixEpoch ? (value.QuadPart - WindowsToUnixEpoch) / 10000ULL : 0;
    }
}

SimpleFrameGenerator::~SimpleFrameGenerator()
{
    if (m_sharedFrameView)
    {
        UnmapViewOfFile(m_sharedFrameView);
        m_sharedFrameView = nullptr;
    }
    if (m_sharedFrameMapping)
    {
        CloseHandle(m_sharedFrameMapping);
        m_sharedFrameMapping = nullptr;
    }
}

HRESULT SimpleFrameGenerator::Initialize(_In_ IMFMediaType* pMediaType)
{
    RETURN_HR_IF_NULL(E_INVALIDARG, pMediaType);

    RETURN_IF_FAILED(pMediaType->GetGUID(MF_MT_SUBTYPE, &m_subType));
    if (m_subType != MFVideoFormat_RGB32 && m_subType != MFVideoFormat_NV12)
    {
        RETURN_HR_MSG(MF_E_UNSUPPORTED_FORMAT, "Unsupported format: %s", winrt::to_hstring(m_subType).data());
    }
    MFGetAttributeSize(pMediaType, MF_MT_FRAME_SIZE, &m_width, &m_height);

    return S_OK;
}

/*:
   Writes to a buffer representing a 2D image.
   Writes a different constant to each line based on row number and current time.
   Assumes top down image, no negative stride and pBuf points to the begnning of the buffer of length len.
   Param:
   pBuf - pointer to beginning of buffer
   pitch - line length in bytes
   len - length of buffer in bytes
*/
HRESULT SimpleFrameGenerator::CreateFrame(
    _Inout_updates_bytes_(len) BYTE* pBuf,
    _In_ DWORD len,
    _In_ LONG pitch,
    _In_ ULONG rgbMask)
{
    if (m_subType == MFVideoFormat_RGB32)
    {
        DEBUG_MSG(L"RGB32 frames %s\n", winrt::to_hstring(MFVideoFormat_RGB32).data());

        RETURN_IF_FAILED(_CreateRGB32Frame(pBuf, len, pitch, m_width, m_height, rgbMask));
    }
    else if(m_subType == MFVideoFormat_NV12)
    {
        DEBUG_MSG(L"NV12 frames %s \n", winrt::to_hstring(MFVideoFormat_NV12).data());

        DWORD frameBuffLen = m_width * m_height * 4;
        wil::unique_cotaskmem_ptr<BYTE[]> spBuff = wil::make_unique_cotaskmem_nothrow<BYTE[]>(frameBuffLen);
        RETURN_IF_NULL_ALLOC(spBuff.get());

        RETURN_IF_FAILED(_CreateRGB32Frame(spBuff.get(), frameBuffLen, m_width * 4, m_width, m_height, rgbMask));
        RETURN_IF_FAILED(RGB32ToNV12Frame(spBuff.get(), frameBuffLen, m_width * 4, m_width, m_height, pBuf, len, pitch));
    }
    else
    {
        return MF_E_UNSUPPORTED_FORMAT;
    }

    return S_OK;
}

//////////////////////////////////////////////////
// private

HRESULT SimpleFrameGenerator::_CreateRGB32Frame(
    _Inout_updates_bytes_(len) BYTE* pBuf,
    _In_ DWORD len,
    _In_ LONG pitch,
    _In_ DWORD width,
    _In_ DWORD height,
    _In_ ULONG rgbMask )
{
    RETURN_HR_IF_NULL(E_INVALIDARG, pBuf);
    if (len < (abs(pitch) * height ))
    {
        return HRESULT_FROM_WIN32(ERROR_INSUFFICIENT_BUFFER);
    }

    if (_CopySharedFrame(pBuf, len, pitch, width, height))
    {
        return S_OK;
    }

    // Studio kapalıyken sakin, markalı bir bekleme karesi gösterilir.
    const LONG rowBytes = abs(pitch);
    for (unsigned int r = 0; r < height; ++r)
    {
        uint32_t* p = reinterpret_cast<uint32_t*>(pBuf + (r * rowBytes));
        for (unsigned int c = 0; c < width; ++c)
        {
            const bool accent = r >= height * 3 / 4 && r < height * 3 / 4 + max(4u, height / 90);
            const bool monogram = c > width * 43 / 100 && c < width * 57 / 100 &&
                r > height * 32 / 100 && r < height * 62 / 100;
            uint32_t color = accent ? 0x0027E58A : (monogram ? 0x00203B32 : 0x00060807);
            *p++ = color & rgbMask;
        }
    }

    return S_OK;
}

bool SimpleFrameGenerator::_EnsureSharedFrameMapping()
{
    if (m_sharedFrameView)
    {
        return true;
    }

    const ULONGLONG now = GetTickCount64();
    if (now - m_lastMappingAttempt < 1000)
    {
        return false;
    }
    m_lastMappingAttempt = now;

    m_sharedFrameMapping = OpenFileMappingW(FILE_MAP_READ, FALSE, SHARED_FRAME_NAME);
    if (!m_sharedFrameMapping)
    {
        return false;
    }

    m_sharedFrameView = static_cast<const BYTE*>(MapViewOfFile(
        m_sharedFrameMapping,
        FILE_MAP_READ,
        0,
        0,
        SHARED_FRAME_HEADER_SIZE + SHARED_FRAME_MAX_BYTES));
    if (!m_sharedFrameView)
    {
        CloseHandle(m_sharedFrameMapping);
        m_sharedFrameMapping = nullptr;
        return false;
    }
    return true;
}

bool SimpleFrameGenerator::_CopySharedFrame(
    _Inout_updates_bytes_(len) BYTE* pBuf,
    _In_ DWORD len,
    _In_ LONG pitch,
    _In_ DWORD width,
    _In_ DWORD height)
{
    if (!_EnsureSharedFrameMapping())
    {
        return false;
    }

    const auto* header = reinterpret_cast<const SharedFrameHeader*>(m_sharedFrameView);
    const auto sequenceBefore = InterlockedCompareExchange64(
        const_cast<volatile LONG64*>(&header->sequence), 0, 0);
    MemoryBarrier();

    if ((sequenceBefore & 1) != 0 ||
        memcmp(header->magic, SHARED_FRAME_MAGIC, sizeof(SHARED_FRAME_MAGIC)) != 0 ||
        header->version != SHARED_FRAME_VERSION ||
        header->headerSize != SHARED_FRAME_HEADER_SIZE ||
        header->pixelFormat != SHARED_FRAME_PIXEL_FORMAT_BGRA ||
        header->width == 0 || header->height == 0 ||
        header->width > 1920 || header->height > 1080 ||
        header->stride < header->width * 4 ||
        header->frameSize < header->stride * header->height ||
        header->frameSize > SHARED_FRAME_MAX_BYTES ||
        UnixTimeMilliseconds() - header->timestampMs > 1500 ||
        len < static_cast<DWORD>(abs(pitch)) * height)
    {
        return false;
    }

    const BYTE* source = m_sharedFrameView + SHARED_FRAME_HEADER_SIZE;
    const LONG destinationStride = abs(pitch);
    for (DWORD y = 0; y < height; ++y)
    {
        const DWORD sourceY = static_cast<DWORD>((static_cast<ULONGLONG>(y) * header->height) / height);
        const BYTE* sourceRow = source + static_cast<size_t>(sourceY) * header->stride;
        BYTE* destinationRow = pBuf + static_cast<size_t>(y) * destinationStride;
        for (DWORD x = 0; x < width; ++x)
        {
            const DWORD sourceX = static_cast<DWORD>((static_cast<ULONGLONG>(x) * header->width) / width);
            memcpy(destinationRow + static_cast<size_t>(x) * 4, sourceRow + static_cast<size_t>(sourceX) * 4, 4);
        }
    }

    MemoryBarrier();
    const auto sequenceAfter = InterlockedCompareExchange64(
        const_cast<volatile LONG64*>(&header->sequence), 0, 0);
    return sequenceBefore == sequenceAfter && (sequenceAfter & 1) == 0;
}

//////////////////////////////////////////////////
// pixelFormatConverter

void SimpleFrameGenerator::RGB24ToYUY2(int R, int G, int B, BYTE* pY, BYTE* pU, BYTE* pV)
{
    *pY = ((66 * R + 129 * G + 25 * B + 128) >> 8) + 16;
    *pU = ((-38 * R - 74 * G + 112 * B + 128) >> 8) + 128;
    *pV = ((112 * R - 94 * G - 18 * B + 128) >> 8) + 128;
}

void SimpleFrameGenerator::RGB24ToY(int R, int G, int B, BYTE* pY)
{
    *pY = ((66 * R + 129 * G + 25 * B + 128) >> 8) + 16;
}

void SimpleFrameGenerator::RGB32ToNV12(BYTE RGB1[8], BYTE RGB2[8], BYTE* pY1, BYTE* pY2, BYTE* pUV)
{
    RGB24ToYUY2(RGB1[2], RGB1[1], RGB1[0], pY1, pUV, pUV + 1);
    RGB24ToY(RGB1[6], RGB1[5], RGB1[4], pY1 + 1);
    RGB24ToYUY2(RGB2[2], RGB2[1], RGB2[0], pY2, pUV, pUV + 1);
    RGB24ToY(RGB2[6], RGB2[5], RGB2[4], pY2 + 1);
};

//////////////////////////////////////////////////
// FrameFormatConverter

HRESULT SimpleFrameGenerator::RGB32ToNV12Frame(_Inout_updates_bytes_(len) BYTE* pbBuff, ULONG cbBuff, long stride, UINT width, UINT height, BYTE* pbBuffOut, ULONG cbBuffOut, long strideOut)
{
    do
    {
        RETURN_HR_IF(E_UNEXPECTED, width * 4 * height > cbBuff);
        RETURN_HR_IF(E_UNEXPECTED, width * 1.5 * height > cbBuffOut);
        RETURN_HR_IF_NULL(E_INVALIDARG, pbBuff);

        RETURN_HR_IF_NULL(E_INVALIDARG, pbBuffOut);
        for (DWORD h = 0; h < height - 1; h += 2)
        {
            BYTE* pRGB1 = h * stride + pbBuff;
            BYTE* pRGB2 = (h + 1) * stride + pbBuff;
            BYTE* pY1 = h * strideOut + pbBuffOut;
            BYTE* pY2 = (h + 1) * strideOut + pbBuffOut;
            BYTE* pUV = (h / 2 + height) * strideOut + pbBuffOut;

            for (DWORD w = 0; w < width; w += 2)
            {
                RGB32ToNV12(pRGB1, pRGB2, pY1, pY2, pUV);
                pRGB1 += 8;
                pRGB2 += 8;
                pY1 += 2;
                pY2 += 2;
                pUV += 2;
            }
        }
    } while (FALSE);

    return S_OK;
}
