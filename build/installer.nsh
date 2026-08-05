; Electron's GPU and renderer children run inside a Windows AppContainer sandbox.
; An AppContainer token can only map DLLs from a directory that grants read+execute
; to ALL APPLICATION PACKAGES (S-1-15-2-1). A fresh NSIS install has no such grant
; on $INSTDIR, so the sandboxed children fail to load their DLLs and the app dies
; on first launch with 0xC0000135 (STATUS_DLL_NOT_FOUND). See also
; scripts/grant-appcontainer-acl.js, which covers the same requirement for local
; dev/test runs against node_modules/electron/dist.
!macro customInstall
  DetailPrint "Granting AppContainer sandbox access to $INSTDIR..."
  nsExec::ExecToLog '"$SYSDIR\icacls.exe" "$INSTDIR" /grant "*S-1-15-2-1:(OI)(CI)(RX)" /T /C'
!macroend
