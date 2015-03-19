# Quick start #
To create a package to update your server installation, perform the following steps:
  * gather the new and updated files and put them in the same directoy structure as the are on the server (as long as the relative paths are the same)
  * create a BIS command file. This file contains the from, to and uninstall directories.
  * include the `bis.js` script in this package
  * put everything in a zip-file or SFX

To install the package, just unzip the file and run `cscript bis.js` (you probably specified this in the "Run after extraction" option of your SFX).

## Command line usage ##
Run `cscript bis.js -h` for more info.

## The BIS command file ##
The format of the BIS command file is described in the supplied XML Schema (bis-1.0.xsd). Descriptive annotations are added. You might want the schema with a graphical tool, for example XML Spy.

# The tools inner working #
The "core" of BIS is the creation of a create-delete list (ActionList in source code). Each item in the list contains the source and destination path of the file, plus a create and a delete attribute:
  * new files only have the create attribute set
  * modified files have both the delete and create attribute set
  * expired files only have the delete attribute set (the source path is empty)

The new and modified files are determined from the `from-base` and `to-base` tags in the BIS command file. The (optional) expired files and folders are determined by files/folders marked with the `.bis-delete` extension. With the `rollback-base` tag, you specify the location for all your backups. Within this directory, a sub-directory is created with the name specified by the `update/@id` attribute (prefixed with the string "bis").

With this list, two batch files are generated. The first (install.bat) performs the actual installation: moving old files to the back-up directory, en copying the new files. The second (uninstall.bat) does the exact opposit. Both batch files are created in the current directory. The uninstall batch-file is moved by the install batch-file to the uninstall folder, when ran.

Note that bis.js must be run at install-time, not when you create the installer package: bis depends on the directory listing of the targetted system.

To accomplish the before mentioned, a number of assumptions are made:
  * you have to know which files are installed on your server;
  * the uninstall.bat file assumes the install.bat file has run;

The backuped files are stored in a single directory without sub-folders for simplicity. The file is prefixed with a sequence number, to avoid name collisions. The existence of the uninstall-folder is used to check if the update was already installed. When uninstalling, the complete uninstall directory is removed.

For extra benefit, all DLL files are considered ActiveX in-proc COM servers. All registration/unregistration logic is also included in the batch file.

No error checking is done in the batch-files. To prevent failures while copying and deleting files, you can specify commands to be run before and after the (un-)installation to temporary shut down the processes which are locking your files.

## Antireg ##
With the `registry/file` tag structure, one ore more registry merge files can be specified to be merged into the registry at install-time. This is performed within the install.bat file. At the same time, an undo file is generated (named uninstall.reg), and is scheduled for mergin in the uninstall.bat file. The following types are supported:
  * REG\_DWORD
  * REG\_BINARY
  * REG\_SZ
  * REG\_EXPAND\_SZ
  * REG\_MULTI\_SZ

When unsupported types or other errors are encountered, comment lines are added to the uninstall.reg file. These lines will be ignored by regedit.exe. When only a key (without default value or name/value pairs) is specified in the merge file, this line is ignored, since there is no way from script to detect this situation.

Also, when a complete key is specified to be removed (ie `[-key]`), antireg does not account for this (because WScript.Shell can't enumerate registry keys).

## Events ##
For flexibility, some events are defined, so you can schedule some "dos" commands. The events at install time are run from the install directory (where the BIS file is located) and the events at uninstall time are run from the uninstall directory. The order of execution of the events (and the other tasks) at install time are:
  1. _registry files are merged_
  1. `run-before`
  1. `run-before-install`
  1. _installation ot the files_
  1. `run-after`
  1. `run-after-install`

The order of execution at uninstall time are:
  1. _registry undo file is merged_
  1. run-before
  1. run-before-uninstall
  1. _uninstallation of the files_
  1. run-after
  1. run-after-uninstall