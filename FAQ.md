# Frequently Asked Questions #

## How do I use BIS from the command-line ##

BIS can be run from the command-line by typing the command bis. Make sure the place BIS is installed is included in your PATH environment variable. Make sure you use cscript (the command line version) as default script host by issueing the command cscript //h:cscript.

## My registry merge file specifies a new key, but after uninstallation the key is not removed ##

Also specify a default value (@="value") in your registry file. If you don't do this, BIS can't detect a new key has been created