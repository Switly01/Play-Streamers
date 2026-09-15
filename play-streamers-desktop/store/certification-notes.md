# Microsoft Store certification notes — 1.9

Play Streamers 1.9 is a packaged Tauri-based Win32 creator workspace. The customer-facing Microsoft Store release is 1.9; the application version is 1.9.0 and the Store-required four-part MSIX package revision is 1.9.1.0. It connects to `https://api.pstreamers.com` and SW Identity over HTTPS. Test on Windows 10 version 2004 (build 19041) or later, or Windows 11, as a standard user. Administrator privileges are not required.

Use the private Product Pro review credentials supplied in the Partner Center Credentials section. In the app, select **Hesabını bağla / Connect account**, sign in on the SW Identity page, and allow the `playstreamers://` deep link to return to the app. The supplied account has Product Pro access. Kick does not need to be connected; stream analytics remain empty until verified channel events exist, which is expected behavior.

Play Streamers Free is not time limited and remains usable without purchase. Optional Pro plans unlock additional tools. Locked tools are labeled by tier in the app.

## Policy 10.1.5 remediation

The publisher website no longer links to a direct Web Installer download. Every public Play Streamers Desktop call to action now opens only the product's official Microsoft Store listing at `https://apps.microsoft.com/detail/9NWZ0TF5K999`. Public product pages do not provide acquisition links for browser extensions; optional Play Connect installation is offered only inside the authenticated account setup flow after an explicit user action. Store descriptions no longer refer to software or plan acquisition outside the Microsoft Store. Play Connect enhances Play Streamers but is not required for the primary product to open or provide its core Free workspace.

Play Streamers does not include Studio, live streaming, local recording, camera or microphone capture, virtual camera, drivers or Windows services. It does not collect or upload raw media.

The submitted `1.9.1.0` x64 MSIX has SHA-256
`102318FF282F3F57E6C4762C54A58D1FC147E2FB9D7C036E2A8F8D089501EC2B`.
The package reached Microsoft certification and the returned report contains no
technical package failure; the requested remediation concerns Store policy 10.1.5.

The preceding `1.9.0.0` x64 MSIX was tested with Windows App Certification Kit
10.0.26100.7705 on Windows 11. The complete command-line run finished with
`OVERALL_RESULT="PASS"`; the report is stored as
`WACK-1.9.0.0.xml`. The
tested package SHA-256 is
`6A68A0C65B19D8118140EFD2AEDBE837C422DEE0EDFDF0BD280CB8CA4D83AFD1`.

## Optional WACK process-launch finding

The WACK report contains one optional static-analysis finding under “Blocked executables”. The package still receives `OVERALL_RESULT="PASS"` with 23 of 24 tests passing. Tauri and its Windows web-link integration reference `CreateProcessW`, `ShellExecuteW` and `ShellExecuteExW` so the application can open the fixed HTTPS support/privacy/identity destinations and the Microsoft Store downloads page declared in its narrow capability allowlist. Play Streamers does not expose a shell or command prompt, execute user-provided commands, run downloaded code, install drivers or services, or request elevation. Text matches such as `bash`, `cmd.exe`, `dnX`, `CDB` and `CmD` are static binary matches, not application commands or executable payloads.

## Store listing icon clarification

The binary package uses the current outlined PS mark. All eight supplied Store
listings include dedicated icons on a fully opaque dark background. Dedicated 300×300,
150×150 and 71×71 PNG listing images are supplied so the icon remains clearly
visible on light and dark Store themes. Every supplied listing tile has an
alpha value of 255 at its sampled edges and corners. Package icon assets retain
transparent outer corners; the dedicated opaque listing icons address the
previous 10.1.1.11 review finding and must be applied in Partner Center.
The files are stored under `store/listing-assets` and can be regenerated with
`scripts/create-store-listing-icons.ps1`.

Localized listing copy and localized screenshots are supplied for Turkish,
English, German, Spanish, French, Russian, Arabic and Japanese. The same eight
languages are declared by the package and are available from the in-app
language selector.

## runFullTrust justification

Play Streamers is a packaged Win32 desktop application built with Tauri. `runFullTrust` is required only to launch the declared `Windows.FullTrustApplication` executable and provide the native desktop window, Windows Credential Manager-backed session storage and deep-link activation. The Microsoft Store build disables the direct-download updater interface and receives updates only through Microsoft Store. The app does not request elevation, install drivers or services, capture camera or microphone input, record media, or execute arbitrary downloaded code. Network access is limited to Play Streamers and SW Identity services for the user's authenticated account, plan, verified channel events and server-generated analytics.
