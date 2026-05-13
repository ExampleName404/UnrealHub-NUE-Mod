!macro KillProcessByName EXE_NAME
  !ifdef INSTALL_MODE_PER_ALL_USERS
    nsExec::Exec `taskkill /f /im "${EXE_NAME}"`
  !else
    nsExec::Exec `%SYSTEMROOT%\System32\cmd.exe /c taskkill /f /im "${EXE_NAME}" /fi "USERNAME eq %USERNAME%"`
  !endif
!macroend

!macro CheckKnownAppProcesses RESULT_VAR
  StrCpy ${RESULT_VAR} 1

  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R1
  ${If} $R1 == 0
    StrCpy ${RESULT_VAR} 0
  ${EndIf}

  !insertmacro FIND_PROCESS "NUE Mod.exe" $R1
  ${If} $R1 == 0
    StrCpy ${RESULT_VAR} 0
  ${EndIf}

  !insertmacro FIND_PROCESS "UnrealHub.exe" $R1
  ${If} $R1 == 0
    StrCpy ${RESULT_VAR} 0
  ${EndIf}

  !insertmacro FIND_PROCESS "unreal-hub.exe" $R1
  ${If} $R1 == 0
    StrCpy ${RESULT_VAR} 0
  ${EndIf}
!macroend

!macro customCheckAppRunning
  !insertmacro CheckKnownAppProcesses $R0
  ${If} $R0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "NUE Mod is currently running. Click OK to close it and continue installation." /SD IDOK IDOK doStop
    Quit

    doStop:
    DetailPrint `Closing running application...`

    !insertmacro KillProcessByName "${APP_EXECUTABLE_FILENAME}"
    !insertmacro KillProcessByName "NUE Mod.exe"
    !insertmacro KillProcessByName "UnrealHub.exe"
    !insertmacro KillProcessByName "unreal-hub.exe"

    Sleep 1500

    !insertmacro CheckKnownAppProcesses $R0
    ${If} $R0 == 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "The application is still running. Please close it manually and click Retry." /SD IDCANCEL IDRETRY doStop
      Quit
    ${EndIf}
  ${EndIf}
!macroend
