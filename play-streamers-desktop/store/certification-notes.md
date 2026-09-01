# Microsoft Store certification notes — 0.14.5

Play Streamers 0.14.5 is a packaged Tauri-based Win32 creator workspace. It connects to `https://api.pstreamers.com` and SW Identity over HTTPS. Test on Windows 10 version 2004 (build 19041) or later, or Windows 11, as a standard user. Administrator privileges are not required.

Use the private Product Pro review credentials supplied in the Partner Center Credentials section. In the app, select **Hesabını bağla / Connect account**, sign in on the SW Identity page, and allow the `playstreamers://` deep link to return to the app. The supplied account has Product Pro access. Kick does not need to be connected; stream analytics remain empty until verified channel events exist, which is expected behavior.

The app is free to install. Play Streamers Free is not time limited and remains usable without purchase. Pro and Product Pro are optional paid plans managed outside the Microsoft Store. Locked tools are labeled by tier in the app.

Play Streamers does not include Studio, live streaming, local recording, camera or microphone capture, virtual camera, drivers or Windows services. It does not collect or upload raw media.

The final `0.14.5.0` x64 MSIX was tested with Windows App Certification Kit
10.0.26100.7705 on Windows 11. The complete command-line run finished with
`OVERALL_RESULT="PASS"`; the report is stored as
`WACK-0.14.5.0.xml`. The
package SHA-256 is
`4D5C576E942A8FEC17CD9A69CE9217352847015C71FB2FE58E1939E8F9FC4758`.

## Store listing icon clarification

The binary package and the English and Turkish Store listings use the current
monochrome PS mark on a fully opaque dark background. Dedicated 300×300,
150×150 and 71×71 PNG listing images are supplied so the icon remains clearly
visible on light and dark Store themes. Every package asset and every listing
tile has an alpha value of 255 at its sampled edges and corners.
The files are stored under `store/listing-assets` and can be regenerated with
`scripts/create-store-listing-icons.ps1`.

## runFullTrust justification

Play Streamers is a packaged Win32 desktop application built with Tauri. `runFullTrust` is required only to launch the declared `Windows.FullTrustApplication` executable and provide the native desktop window, Windows Credential Manager-backed session storage and deep-link activation. The Microsoft Store build disables the direct-download updater interface and receives updates only through Microsoft Store. The app does not request elevation, install drivers or services, capture camera or microphone input, record media, or execute arbitrary downloaded code. Network access is limited to Play Streamers and SW Identity services for the user's authenticated account, plan, verified channel events and server-generated analytics.
