You can find the examples in the directories prefixed with a number. You don't need to run the examples in this order

All examples use the toBase and rollbackBase in this folder. 

0_simple: installs a new file, and replaces a modified file.
1_delete: demonstrates the removal of the new file, installed by 0_simple
2_dll: installs a dll, and demonstrates how to stop and start IIS (which may lock your DLL files). Check out the regsvr32 calls in the batch-files.
3_subdir: demonstrates subdirectories also work with BIS
4_newsubdir: a new sub-directory is created in the destination
5_folder: some folder and sub-folder operations
6_dirdel: shows how to remove directories, including the containing files.

2_dll: skip, te traag
7_multi_update: nog geen testcases