// Play Streamers virtual camera registration helper.
// The Media Foundation design is based on Microsoft's Windows-Camera sample (MIT).

#include <windows.h>
#include <mfapi.h>
#include <mferror.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mfvirtualcamera.h>
#include <ks.h>
#include <ksmedia.h>
#include <string>
#include <iostream>

#pragma comment(lib, "mfplat")
#pragma comment(lib, "mf")
#pragma comment(lib, "mfuuid")
#pragma comment(lib, "Mfsensorgroup")

namespace
{
    constexpr wchar_t CameraName[] = L"Play Streamers Camera";
    constexpr wchar_t SourceClsid[] = L"{7F293AB7-BE5C-4E3F-97D1-C10D938637E1}";
    constexpr wchar_t ComRegistryPath[] = L"SOFTWARE\\Classes\\CLSID\\{7F293AB7-BE5C-4E3F-97D1-C10D938637E1}\\InProcServer32";

    HRESULT EnsureDirectory(const std::wstring& path)
    {
        if (CreateDirectoryW(path.c_str(), nullptr) || GetLastError() == ERROR_ALREADY_EXISTS) return S_OK;
        return HRESULT_FROM_WIN32(GetLastError());
    }

    HRESULT InstalledMediaSourcePath(std::wstring& path)
    {
        wchar_t programFiles[MAX_PATH]{};
        DWORD length = GetEnvironmentVariableW(L"ProgramW6432", programFiles, MAX_PATH);
        if (!length || length >= MAX_PATH) length = GetEnvironmentVariableW(L"ProgramFiles", programFiles, MAX_PATH);
        if (!length || length >= MAX_PATH) return HRESULT_FROM_WIN32(ERROR_PATH_NOT_FOUND);
        const std::wstring vendor = std::wstring(programFiles) + L"\\SW CREATE";
        const std::wstring product = vendor + L"\\Play Streamers";
        const std::wstring camera = product + L"\\VirtualCamera";
        HRESULT hr = EnsureDirectory(vendor);
        if (SUCCEEDED(hr)) hr = EnsureDirectory(product);
        if (SUCCEEDED(hr)) hr = EnsureDirectory(camera);
        if (SUCCEEDED(hr)) path = camera + L"\\PlayStreamersVirtualCamera.dll";
        return hr;
    }

    HRESULT DeployMediaSource(const std::wstring& sourcePath, std::wstring& installedPath)
    {
        const DWORD attributes = GetFileAttributesW(sourcePath.c_str());
        if (attributes == INVALID_FILE_ATTRIBUTES || (attributes & FILE_ATTRIBUTE_DIRECTORY))
        {
            return HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND);
        }
        HRESULT hr = InstalledMediaSourcePath(installedPath);
        if (SUCCEEDED(hr) && !CopyFileW(sourcePath.c_str(), installedPath.c_str(), FALSE))
        {
            hr = HRESULT_FROM_WIN32(GetLastError());
        }
        return hr;
    }

    void DeleteInstalledMediaSource()
    {
        std::wstring path;
        if (SUCCEEDED(InstalledMediaSourcePath(path))) DeleteFileW(path.c_str());
    }

    // {C7F7C57B-DF30-41D0-AFFC-15201CDF920D}
    const GUID VCamKind =
        { 0xc7f7c57b, 0xdf30, 0x41d0, { 0xaf, 0xfc, 0x15, 0x20, 0x1c, 0xdf, 0x92, 0x0d } };

    bool IsSupportedWindows(UINT32* buildNumber = nullptr)
    {
        using RtlGetVersionFn = LONG(WINAPI*)(OSVERSIONINFOW*);
        const HMODULE module = GetModuleHandleW(L"ntdll.dll");
        const auto rtlGetVersion = module
            ? reinterpret_cast<RtlGetVersionFn>(GetProcAddress(module, "RtlGetVersion"))
            : nullptr;
        OSVERSIONINFOW version{};
        version.dwOSVersionInfoSize = sizeof(version);
        if (!rtlGetVersion || rtlGetVersion(&version) != 0) return false;
        if (buildNumber) *buildNumber = version.dwBuildNumber;
        return version.dwMajorVersion > 10 || (version.dwMajorVersion == 10 && version.dwBuildNumber >= 22000);
    }

    template<typename T>
    void Release(T*& value)
    {
        if (value)
        {
            value->Release();
            value = nullptr;
        }
    }

    std::wstring HResultMessage(HRESULT hr)
    {
        wchar_t* raw = nullptr;
        const DWORD count = FormatMessageW(
            FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
            nullptr,
            static_cast<DWORD>(hr),
            0,
            reinterpret_cast<wchar_t*>(&raw),
            0,
            nullptr);
        std::wstring message = count && raw ? raw : L"Bilinmeyen Windows hatasi";
        if (raw) LocalFree(raw);
        while (!message.empty() && (message.back() == L'\r' || message.back() == L'\n')) message.pop_back();
        return message;
    }

    void PrintError(const wchar_t* operation, HRESULT hr)
    {
        std::wcerr << L"{\"ok\":false,\"operation\":\"" << operation
                   << L"\",\"hresult\":\"0x" << std::hex << static_cast<unsigned long>(hr)
                   << L"\",\"message\":\"" << HResultMessage(hr) << L"\"}" << std::endl;
        wchar_t tempPath[MAX_PATH]{};
        if (GetTempPathW(MAX_PATH, tempPath))
        {
            wcscat_s(tempPath, L"play-streamers-vcam-manager.log");
            HANDLE log = CreateFileW(tempPath, FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
            if (log != INVALID_HANDLE_VALUE)
            {
                wchar_t line[256]{};
                swprintf_s(line, L"%s 0x%08X\r\n", operation, static_cast<unsigned int>(hr));
                DWORD written = 0;
                WriteFile(log, line, static_cast<DWORD>(wcslen(line) * sizeof(wchar_t)), &written, nullptr);
                CloseHandle(log);
            }
        }
    }

    HRESULT SetRegistryString(HKEY key, const wchar_t* name, const std::wstring& value)
    {
        const auto bytes = static_cast<DWORD>((value.size() + 1) * sizeof(wchar_t));
        const LONG result = RegSetValueExW(
            key,
            name,
            0,
            REG_SZ,
            reinterpret_cast<const BYTE*>(value.c_str()),
            bytes);
        return HRESULT_FROM_WIN32(result);
    }

    HRESULT RegisterComServer(const std::wstring& dllPath)
    {
        const DWORD attributes = GetFileAttributesW(dllPath.c_str());
        if (attributes == INVALID_FILE_ATTRIBUTES || (attributes & FILE_ATTRIBUTE_DIRECTORY))
        {
            return HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND);
        }

        HKEY key = nullptr;
        const LONG created = RegCreateKeyExW(
            HKEY_LOCAL_MACHINE,
            ComRegistryPath,
            0,
            nullptr,
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE | KEY_WOW64_64KEY,
            nullptr,
            &key,
            nullptr);
        if (created != ERROR_SUCCESS) return HRESULT_FROM_WIN32(created);

        HRESULT hr = SetRegistryString(key, nullptr, dllPath);
        if (SUCCEEDED(hr)) hr = SetRegistryString(key, L"ThreadingModel", L"Both");
        RegCloseKey(key);
        return hr;
    }

    HRESULT UnregisterComServer()
    {
        const LONG result = RegDeleteTreeW(
            HKEY_LOCAL_MACHINE,
            L"SOFTWARE\\Classes\\CLSID\\{7F293AB7-BE5C-4E3F-97D1-C10D938637E1}");
        return result == ERROR_FILE_NOT_FOUND ? S_OK : HRESULT_FROM_WIN32(result);
    }

    HRESULT CreateCamera(IMFVirtualCamera** camera)
    {
        if (!camera) return E_POINTER;
        if (!IsSupportedWindows()) return HRESULT_FROM_WIN32(ERROR_OLD_WIN_VERSION);
        *camera = nullptr;
        HRESULT hr = MFCreateVirtualCamera(
            MFVirtualCameraType_SoftwareCameraSource,
            MFVirtualCameraLifetime_System,
            MFVirtualCameraAccess_CurrentUser,
            CameraName,
            SourceClsid,
            nullptr,
            0,
            camera);
        if (SUCCEEDED(hr)) hr = (*camera)->SetUINT32(VCamKind, 0);
        return hr;
    }

    HRESULT InstallCamera(const std::wstring& dllPath)
    {
        std::wstring installedPath;
        HRESULT hr = DeployMediaSource(dllPath, installedPath);
        if (SUCCEEDED(hr)) hr = RegisterComServer(installedPath);
        if (FAILED(hr)) return hr;

        IMFVirtualCamera* camera = nullptr;
        hr = CreateCamera(&camera);
        if (SUCCEEDED(hr)) hr = camera->Start(nullptr);
        if (camera)
        {
            const HRESULT shutdown = camera->Shutdown();
            if (SUCCEEDED(hr)) hr = shutdown;
        }
        Release(camera);
        if (FAILED(hr))
        {
            UnregisterComServer();
            DeleteInstalledMediaSource();
        }
        return hr;
    }

    HRESULT ActivateCamera()
    {
        IMFVirtualCamera* camera = nullptr;
        HRESULT hr = CreateCamera(&camera);
        if (FAILED(hr)) PrintError(L"create-camera", hr);
        if (SUCCEEDED(hr))
        {
            hr = camera->Start(nullptr);
            if (FAILED(hr)) PrintError(L"start-camera", hr);
        }
        if (camera)
        {
            const HRESULT shutdown = camera->Shutdown();
            if (FAILED(shutdown)) PrintError(L"shutdown-camera", shutdown);
            if (SUCCEEDED(hr)) hr = shutdown;
        }
        Release(camera);
        return hr;
    }

    HRESULT RemoveCamera()
    {
        IMFVirtualCamera* camera = nullptr;
        HRESULT hr = CreateCamera(&camera);
        if (SUCCEEDED(hr))
        {
            const HRESULT remove = camera->Remove();
            if (FAILED(remove) && remove != HRESULT_FROM_WIN32(ERROR_NOT_FOUND)) hr = remove;
            // Remove already shuts the virtual-camera object down. Calling Shutdown
            // afterwards can legitimately return MF_E_SHUTDOWN, which must not turn a
            // successful uninstall into an error exit code.
            camera->Shutdown();
        }
        Release(camera);
        const HRESULT registry = UnregisterComServer();
        DeleteInstalledMediaSource();
        return FAILED(hr) ? hr : registry;
    }

    HRESULT FindCamera(IMFActivate** matchingActivate)
    {
        if (matchingActivate) *matchingActivate = nullptr;
        IMFAttributes* attributes = nullptr;
        IMFActivate** devices = nullptr;
        UINT32 count = 0;
        HRESULT hr = MFCreateAttributes(&attributes, 2);
        if (SUCCEEDED(hr)) hr = attributes->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE, MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID);
        if (SUCCEEDED(hr)) hr = attributes->SetGUID(MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_CATEGORY, KSCATEGORY_VIDEO_CAMERA);
        if (SUCCEEDED(hr)) hr = MFEnumDeviceSources(attributes, &devices, &count);

        bool found = false;
        for (UINT32 index = 0; SUCCEEDED(hr) && index < count; ++index)
        {
            wchar_t* name = nullptr;
            UINT32 length = 0;
            if (SUCCEEDED(devices[index]->GetAllocatedString(MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME, &name, &length)))
            {
                found = name && std::wstring(name).find(CameraName) != std::wstring::npos;
                CoTaskMemFree(name);
            }
            if (found && matchingActivate)
            {
                devices[index]->AddRef();
                *matchingActivate = devices[index];
            }
            if (found) break;
        }

        for (UINT32 index = 0; index < count; ++index) Release(devices[index]);
        CoTaskMemFree(devices);
        Release(attributes);
        return found ? S_OK : HRESULT_FROM_WIN32(ERROR_NOT_FOUND);
    }

    HRESULT TestCamera()
    {
        IMFActivate* activate = nullptr;
        IMFMediaSource* source = nullptr;
        IMFSourceReader* reader = nullptr;
        IMFSample* sample = nullptr;
        HRESULT hr = FindCamera(&activate);
        if (SUCCEEDED(hr)) hr = activate->ActivateObject(IID_PPV_ARGS(&source));
        if (SUCCEEDED(hr)) hr = MFCreateSourceReaderFromMediaSource(source, nullptr, &reader);
        DWORD stream = 0;
        DWORD flags = 0;
        LONGLONG timestamp = 0;
        if (SUCCEEDED(hr))
        {
            for (UINT32 attempt = 0; attempt < 60 && !sample; ++attempt)
            {
                hr = reader->ReadSample(static_cast<DWORD>(MF_SOURCE_READER_FIRST_VIDEO_STREAM), 0, &stream, &flags, &timestamp, &sample);
                if (FAILED(hr) || (flags & MF_SOURCE_READERF_ERROR)) break;
            }
        }
        if (SUCCEEDED(hr) && !sample) hr = MF_E_NO_SAMPLE_TIMESTAMP;
        if (source) source->Shutdown();
        if (activate) activate->ShutdownObject();
        Release(sample);
        Release(reader);
        Release(source);
        Release(activate);
        return hr;
    }
}

int wmain(int argc, wchar_t** argv)
{
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    const bool uninitialize = SUCCEEDED(hr);
    if (hr == RPC_E_CHANGED_MODE) hr = S_OK;
    if (SUCCEEDED(hr)) hr = MFStartup(MF_VERSION);
    if (FAILED(hr))
    {
        PrintError(L"startup", hr);
        return 1;
    }

    std::wstring operation = argc > 1 ? argv[1] : L"status";
    if (operation == L"install")
    {
        hr = argc == 3 ? InstallCamera(argv[2]) : E_INVALIDARG;
    }
    else if (operation == L"register")
    {
        hr = argc == 3 ? RegisterComServer(argv[2]) : E_INVALIDARG;
    }
    else if (operation == L"activate")
    {
        hr = ActivateCamera();
    }
    else if (operation == L"uninstall")
    {
        hr = RemoveCamera();
    }
    else if (operation == L"test")
    {
        hr = TestCamera();
    }
    else if (operation == L"status")
    {
        UINT32 buildNumber = 0;
        const bool supported = IsSupportedWindows(&buildNumber);
        hr = supported ? FindCamera(nullptr) : HRESULT_FROM_WIN32(ERROR_OLD_WIN_VERSION);
        std::wcout << L"{\"ok\":true,\"supported\":" << (supported ? L"true" : L"false")
                   << L",\"buildNumber\":" << buildNumber << L",\"installed\":"
                   << (SUCCEEDED(hr) ? L"true" : L"false") << L"}" << std::endl;
        hr = S_OK;
    }
    else
    {
        hr = E_INVALIDARG;
    }

    if (operation != L"status")
    {
        if (SUCCEEDED(hr)) std::wcout << L"{\"ok\":true,\"operation\":\"" << operation << L"\"}" << std::endl;
        else PrintError(operation.c_str(), hr);
    }

    MFShutdown();
    if (uninitialize) CoUninitialize();
    return SUCCEEDED(hr) ? 0 : 1;
}
