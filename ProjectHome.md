With BIS, you quickly create an setup, to install new and modified files, and optionally remove expired files. BIS is most useful if you need to update a server-side installation of your software. It needs minimal setup, and still creates an uninstaller. And most importantly, you don't need to alter your script, when you last-minute need to add a file to the installer.

Do you need to install some files? Use BIS, because:

  * No need to create an install-script: just specify a from and to directory.
  * An uninstaller will automatically be generated
  * COM DLL's will automatically be registered
  * An uninstaller for registry files (.reg) is automatically generated!

# Why use BIS #

BIS is a near zero-config installer, for use on the Windows Server platform. It's ideally suited for use in situations where you frequently need to create installers. BIS saves time, because it gives you a thoroughly tested installer. Based on what actually gets installed, BIS generates an uninstaller. This ensures that after a rollback, the system is left the same way as it was before the installation.

When you need to update a SQL server database, or when an operator needs to interact with the installer (by supplying an install directory for example), BIS might be less adequate choice.

A typicall situation for BIS is the installation of some ASP files, maybe a couple ActiveX DLL's. Other file-types are not a problem either. Installation of NT services are also possible. Adding registry entries is done by regedit's merge file format. BIS makes a perfect duo, when combined with an WinRar of WinZIP SFX container for the transport of files.
