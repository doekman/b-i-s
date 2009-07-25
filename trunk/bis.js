/*constants*/
var $appVersion='0.8.2'; //version of the application, filled in by the NAnt build proces
var $bisHeader='BIS: Barebone Installation System - version '+$appVersion+' - http://bis.catsdeep.com';
var schemaURL='http://www.catsdeep.com/cudc/2004/bis-1.0.xsd';
var $info=0,$warning=1,$error=2;
var rxDLL=/\.dll$/i;
var rxBisDelete=/\.bis-delete$/i;
/*helpers*/
var fso;
var shell;
/*state*/
var register=false, unregister=false;
var createLogFiles=true;
var runBatchFile=true;
var validate=false; 
var bisFileName; //the fullname (path+filename) of the Job file
var bisDocument; //the file, loaded as DOMDocument
var ActionList;
/*verbosity*/
var alwaysPause=false,pauseOnWarning=false,pauseOnError=false; //when to pause this script at program exit
var warned=false,errors=false; //true when the user has been warned (or shown an error), .. error
/*antireg*/
var $result=['eof','heading','empty','key','namevalue']
var $result_eof=0;				//end of file
var $result_heading=1;		//header line
var $result_empty=2;			//empty line
var $result_key=3;				//key line [hklc\..]
var $result_namevalue=4;	//name="value"

Main(WScript.Arguments);

function Main(args)
{
	DisplayCopyright();
	HandleArguments(args);
	CheckAndInitObjects();
	if(register) {
		RegisterExtension();
	}
	if(unregister) {
		UnRegisterExtension();
	}
	if(bisFileName) {
		LoadBisDocument();
		ValidateBisFile();
		CreateActionList();
		CheckDoubleInstallation();
		CreateBatchFiles();
		if(runBatchFile) {
			RunInstallBatchFile();
		}
	}
	else {
		Display($info,'Not asked to generate scripts');
	}
	ExitProgram(0);
}
function CheckAndInitObjects()
{
	try	{
		fso=WScript.CreateObject('Scripting.FileSystemObject');
		shell=WScript.CreateObject("WScript.Shell");
	}
	catch(e) {
		Display($error,'Windows Script Host doesn\'t seem to be installed properly');
	}
	try	{
		if(validate) {
			bisDocument=new ActiveXObject("MSXML2.DOMDocument.4.0"); //CreateObject doesn't work, threading-model problem???
		}
		else {
			bisDocument=WScript.CreateObject('Msxml2.DOMDocument');
		}
	}
	catch(e)	{
		Display($error,'Microsoft XML '+(validate?'4.0':'3.0 of 4.0')+' isn\'t installed');
	}
}
function HandleArguments(args)
{
	if(args.length==0) {
		Display($warning,'No arguments supplied\n');
		DisplayHelp();
		ExitProgram(1);
	}
	for(var i=0; i<args.length; i++)
	{
		var arg=args(i);
		if(arg.substr(0,1)=='/') arg='-'+arg.substr(1);
		if(arg.substr(0,1)=='-') arg=arg.toLowerCase();

		switch(arg) {
			case '-l':
				createLogFiles=false;
				break;
			case '-r': case '-r+':
				register=true;
				break;
			case '-r-':
				unregister=true;
				break;
			case '-g':
				runBatchFile=false;
				break;
			case '-p':
				alwaysPause=true;
				break;
			case '-pw': 
				pauseOnWarning=true;
				break;
			case '-pe': 
				pauseOnError=true;
				break;
			case '-v':
				validate=true;
				break;
			case '-help': case '-h': case '-?':
				DisplayHelp();
				break;
			default:
				if(arg.substr(1)=='-') {
					Display($warning,'Unrecognized argument "'+arg+'"');
				}
				else { //assume it's the filename
					bisFileName=arg;
				}
				break;
		}
	}
}
/**user communication**********************************************************/
function DisplayCopyright()
{
	WScript.Echo('BIS: Barebone Installation System v'+$appVersion+' - (c) Cats Deep 2004');
	WScript.Echo('');
}
function DisplayHelp()
{
	WScript.Echo('Usage: cscript bis.js [-help] | [-r] [-g] [-p[w|e]] [bis-filename]');
	WScript.Echo('');
	WScript.Echo('  -help  Displays this message');
	WScript.Echo('  -g     Only generate batch-files, don\'t execute install.bat');
	WScript.Echo('  -l     Don\'t create log-files from batch-output (letter L, not digit one)');
	WScript.Echo('  -p     Always pause before exit');
	WScript.Echo('  -pw    Pause on warning or error before exit');
	WScript.Echo('  -pe    Pause on warning before exit');
	WScript.Echo('  -r     Associate (self-register) the .bis extension with this script');
	WScript.Echo('  -r-    Remove the association of the .bis extension');
	WScript.Echo('  -v     Validate bis-filename against XML schema');
	WScript.Echo('');
	WScript.Echo('XML Schema: '+schemaURL);
	ExitProgram(0);
}
function ExitProgram(exitcode)
{
	if(alwaysPause||(warned&&pauseOnWarning)||(errors&&pauseOnError)) {
		WScript.StdOut.Write('Press enter to quit...');
		WScript.StdIn.Read(1);
	}
	WScript.Quit(exitcode);
}
function Display(type)
{
	var prefix=['-','!','#'][type]+' ';
	if(type>=$warning) warned=true;
	if(type>=$error) errors=true;
	for(var i=1; i<arguments.length; i++) {
		WScript.Echo(prefix+arguments[i]);
	}
	if(type>=$error) ExitProgram(1);
}
/**command line actions/preparations*******************************************/
function RegisterExtension()
{
	var ext='.bis';
	var className='BIS.Job';
	var test   ='cscript.exe //Nologo "'+WScript.ScriptFullName+'" -pw -g "%1"';
	var install='cscript.exe //Nologo "'+WScript.ScriptFullName+'" -p "%1"';

	Display($info,'Registering the file-type '+ext);
	try	{
		shell.RegWrite('HKCR\\'+ext+'\\',className,'REG_SZ');
		shell.RegWrite('HKCR\\'+ext+'\\Content Type','text/xml','REG_SZ');
		shell.RegWrite('HKCR\\'+className+'\\','Barebone Installation System Job','REG_SZ');
		shell.RegWrite('HKCR\\'+className+'\\DefaultIcon\\',WScript.ScriptFullName.replace('bis.js','BIS.ico'),'REG_SZ');
		shell.RegWrite('HKCR\\'+className+'\\shell\\','Test','REG_SZ');
		shell.RegWrite('HKCR\\'+className+'\\shell\\Test\\','&Generate BIS batch-files','REG_SZ');
		shell.RegWrite('HKCR\\'+className+'\\shell\\Test\\command\\',test,'REG_SZ');
		shell.RegWrite('HKCR\\'+className+'\\shell\\Install\\','BIS &Install','REG_SZ');
		shell.RegWrite('HKCR\\'+className+'\\shell\\Install\\command\\',install,'REG_SZ');
	}
	catch(e) {
		Display($warning,'Problems registering, reason:',e.description);
	}
}
function UnRegisterExtension()
{
	var ext='.bis';
	var className='BIS.Job';

	Display($info,'Un-registering the file-type '+ext);
	try	{
		shell.RegDelete('HKCR\\'+className+'\\shell\\Test\\command\\');
		shell.RegDelete('HKCR\\'+className+'\\shell\\Test\\');
		shell.RegDelete('HKCR\\'+className+'\\shell\\Install\\command\\');
		shell.RegDelete('HKCR\\'+className+'\\shell\\Install\\');
		shell.RegDelete('HKCR\\'+className+'\\shell\\DefaultIcon\\');
		shell.RegDelete('HKCR\\'+className+'\\shell\\');
		shell.RegDelete('HKCR\\'+className+'\\');
		shell.RegDelete('HKCR\\'+ext+'\\');
	}
	catch(e) {
		Display($warning,'Problems un-registering, reason:',e.description);
	}
}
function LoadBisDocument()
{
	var pe; //parse error
	if(!fso.FileExists(bisFileName)) {
		Display($error,'Input file '+bisFileName+' doesn\'t exist in working folder '+shell.CurrentDirectory+'.');
	}
	bisDocument.async=false;
	if(validate) {
		var schemaCache=new ActiveXObject("MSXML2.XMLSchemaCache.4.0");
		schemaCache.add('','http://www.catsdeep.com/cudc/2004/bis-1.0.xsd');
		bisDocument.schemas=schemaCache;
		bisDocument.resolveExternals=true;
	}
	else {
		bisDocument.resolveExternals=false;
	}
	bisDocument.load(bisFileName);
	if(bisDocument.parseError.errorCode!=0) {
		pe=bisDocument.parseError;
		Display($error,'Error parsing file "'+bisFileName+'" at position ('+pe.line+','+pe.linepos+'):\r\n  '+pe.reason);
	}
	bisDocument.setProperty("SelectionLanguage", "XPath");
}
function ValidateBisFile()
{
	//-- Validate input without schema, just to make sure.
//	var mandatory=['/bis/@id','/bis/update/from-base/text()','/bis/update/to-base/text()','/bis/rollback-base/text()'];
	var mandatory=['/bis/@id','/bis/rollback-base/text()'];
	for(var i=0; i<mandatory.length; i++) {
		var nodes=bisDocument.selectSingleNode(mandatory[i]);
		if(nodes==null) {
			Display($error,'Input file incorrect: no '+mandatory[i]+' node found');
		}
	}
}
function CheckDoubleInstallation()
{
	if(fso.FileExists(ActionList.installerLog)) {
		Display($error,'This update already seems to be installed.','The logfile ['+ActionList.installerLog+'] already exist.');
	}
}
function CreateBatchFiles()
{
	var inst_bat,inst_name='install',  inst_redirect='>>'+inst_name+'.log 2>&1 ';
	var unin_bat,unin_name='uninstall',unin_redirect='>>'+unin_name+'.log 2>&1 ';
	function inst_Display(s) {
		var cmd=s?'echo '+s:'echo.';
		inst_bat.WriteLine(cmd);
		if(createLogFiles) inst_bat.WriteLine(inst_redirect+cmd);
	}
	function inst_Write(s,noLog,echoCmd) {
		if(noLog || !createLogFiles) {
			inst_bat.WriteLine(s);
		}
		else {
			if(echoCmd) {
				inst_bat.WriteLine(inst_redirect+'echo RUN:'+s);
				inst_bat.WriteLine('echo RUN:'+s);
			}
			inst_bat.WriteLine(inst_redirect+s);
		}
	}
	function unin_Display(s) {
		var cmd=s?'echo '+s:'echo.';
		unin_bat.WriteLine(cmd);
		if(createLogFiles) unin_bat.WriteLine(unin_redirect+cmd);
	}
	function unin_Write(s,noLog,echoCmd) {
		if(noLog || !createLogFiles) {
			unin_bat.WriteLine(s);
		}
		else {
			if(echoCmd) {
				unin_bat.WriteLine(unin_redirect+'echo RUN:'+s); //write to log
				unin_bat.WriteLine('echo RUN:'+s); //write to screen
			}
			unin_bat.WriteLine(unin_redirect+s);
		}
	}
	function Write2BothBat(s,noLog,echoCmd) {
		inst_Write(s,noLog,echoCmd);
		unin_Write(s,noLog,echoCmd);
	}
	function WriteCmdList(cmdList,remark,writer)
	{
		if(typeof writer=='undefined') writer=Write2BothBat;
		writer('echo REM:-- '+remark);
		for(var i=0; i<cmdList.length; i++) {
			var cmd=cmdList[i];
			var errorlevelCheck=cmd.parentNode.getAttribute('errorlevel-check'); //default value==true
			writer(cmd.nodeValue,false,true);
			if(errorlevelCheck==null||errorlevelCheck.nodeValue=='true') {
				writer('if errorlevel 1 (',true);
				writer('  echo The previous command exitted with errorlevel %errorlevel%, quiting...');
				writer('  goto end',true);
				writer(')',true);
			}
		}
	}

	var i;
	//-- Create installer batch-file
	ActionList.installer=shell.CurrentDirectory+'\\'+inst_name+'.bat';
	ActionList.installerLog=shell.CurrentDirectory+'\\'+inst_name+'.log';
	inst_bat=fso.CreateTextFile(ActionList.installer,true);
	inst_Write('@echo off',true);
	inst_Write('if exist install.log goto alreadyInstalled',true);
	if(!createLogFiles) {
		//Create a log-file anyway, just for install detection purposes
		inst_bat.WriteLine('echo Marker file. Patch  '+ActionList.id+' has been installed. '+inst_redirect.replace('>>','>'));
	}
	//--| Starting log-file must happen after installation check
	inst_Display($bisHeader);
	inst_Display('');
	inst_Display('INF:Installing ID '+ActionList.id+(ActionList.description?' - '+ActionList.description:''),false,true);

	inst_Write('set undir='+ActionList.rollbackBase,false,true);
	inst_Write('mkdir "%undir%"',false,true);
	inst_Write('move "uninstall.bat" "%undir%"',false,true);
	if(ActionList.registryUndoFile) {
		inst_Write('move "uninstall.reg" "%undir%"',false,true);
		for(i=0; i<ActionList.registryFiles.length; i++) {
			var regFileName=ActionList.registryFiles[i];
			inst_Write('regedit.exe /s '+regFileName,false,true);
			inst_Write('rename '+regFileName+' '+regFileName+'.merged',false,true);
		}
	}
	//-- Create un-installer batch-file
	ActionList.uninstaller=shell.CurrentDirectory+'\\'+unin_name+'.bat';
	unin_bat=fso.CreateTextFile(ActionList.uninstaller,true);
	unin_Write('@echo off',true);
	unin_Write('if exist uninstall.log goto alreadyUninstalled',true);
	if(!createLogFiles) {
		//Create a log-file anyway, just for uninstall detection purposes
		unin_bat.WriteLine('echo Marker file. Patch '+ActionList.id+' has been uninstalled. '+unin_redirect.replace('>>','>'));
	}
	unin_Display($bisHeader);
	unin_Display('');
	unin_Display('INF:Uninstalling ID '+ActionList.id+(ActionList.description?' - '+ActionList.description:''),false,true);

	unin_Write('cd /d '+ActionList.rollbackBase,false,true);
	//--=| handle antireg file
	if(ActionList.registryUndoFile) {
		unin_Write('regedit.exe /s '+ActionList.registryUndoFile,false,true);
		unin_Write('rename '+ActionList.registryUndoFile+' '+ActionList.registryUndoFile+'.merged',false,true);
	}
	//--=| run before
	if(ActionList.runBefore.length>0) WriteCmdList(ActionList.runBefore,'Run Before');
	if(ActionList.runBeforeInstall.length>0) WriteCmdList(ActionList.runBeforeInstall,'Run Before Install',inst_Write);
	if(ActionList.runBeforeUnInstall.length>0) WriteCmdList(ActionList.runBeforeUnInstall,'Run Before Uninstall',unin_Write);
	Write2BothBat('REM ____________________________________________',true);
	//-- the actual stuff
	for(i=0; i<ActionList.length; i++) {
		var item=ActionList[i];
		var uninstallPrefix=_ZeroPad(i,(''+ActionList.length).length);
		item.WriteToBatch(inst_Write,unin_Write,uninstallPrefix);
	}
	//-- run after
	if(ActionList.runAfter.length>0) WriteCmdList(ActionList.runAfter,'Run After');
	if(ActionList.runAfterInstall.length>0) WriteCmdList(ActionList.runAfterInstall,'Run After Install',inst_Write);
	if(ActionList.runAfterUnInstall.length>0) WriteCmdList(ActionList.runAfterUnInstall,'Run After Uninstall',unin_Write);
	//-- Coda
	Write2BothBat('echo  OK:Thank you for using BIS, a Cats Deep product.');
	inst_Write('goto end',true);
	inst_Write(':alreadyInstalled',true);
	inst_Write('echo NOK:Patch is already installed; no work is done',true);
	unin_Write('goto end',true);
	unin_Write(':alreadyUninstalled',true);
	unin_Write('echo NOK:Patch is already uninstalled; no work is done',true);
	Write2BothBat(':end',true);
	//-- Close files
	inst_bat.Close();
	unin_bat.Close();
	//clean-up file. Zet na de uninstall de boel weer terug zoals voor installatie
	var clean=fso.CreateTextFile(shell.CurrentDirectory+'\\clean.bat',true);
	clean.WriteLine('@echo off');
	clean.WriteLine('echo This batch-file will always end with the message:');
	clean.WriteLine('echo "The system cannot find the path specified"');
	clean.WriteLine('echo This is OK (this batch file deletes itself by deleting its containing directory');
	clean.WriteLine('echo.');
	clean.WriteLine('if not exist "'+ActionList.rollbackBase+'" goto clean');
	clean.WriteLine('if exist "'+ActionList.rollbackBase+'\\'+unin_name+'.log" goto clean');
	clean.WriteLine('echo Can\'t clean. Please run uninstall first');
	clean.WriteLine('goto end');
	clean.WriteLine(':clean');
	clean.WriteLine('if exist "'+ActionList.rollbackBase+'" rd /s /q "'+ActionList.rollbackBase+'"');
	clean.WriteLine('if exist install.log del /q install.log');
	if(ActionList.registryFiles) {
		for(i=0; i<ActionList.registryFiles.length; i++) {
			var regFileName=ActionList.registryFiles[i];
			clean.WriteLine('if exist "'+regFileName+'.merged" rename "'+regFileName+'.merged" "'+regFileName+'"');
		}
	}
	clean.WriteLine('del /q install.bat');
	clean.WriteLine('del /q clean.bat');
	clean.WriteLine(':end');
	clean.Close();
}
function RunInstallBatchFile()
{
	shell.Run(ActionList.installer,1,false);
}
function CreateActionList()
{
	ActionList=[];

	//-- Get properties
	ActionList.id=_GetTextValue('/bis/@id');
	ActionList.description=_GetTextValue('/bis/@description');
	ActionList.runBefore=bisDocument.selectNodes('/bis//run-before/cmd/text()');
	ActionList.runAfter=bisDocument.selectNodes('/bis/run-after/cmd/text()');
	ActionList.runBeforeInstall=bisDocument.selectNodes('/bis//run-before-install/cmd/text()');
	ActionList.runAfterInstall=bisDocument.selectNodes('/bis/run-after-install/cmd/text()');
	ActionList.runBeforeUnInstall=bisDocument.selectNodes('/bis//run-before-uninstall/cmd/text()');
	ActionList.runAfterUnInstall=bisDocument.selectNodes('/bis/run-after-uninstall/cmd/text()');
	//-- Get base directories
	ActionList.rollbackBase=_GetDirectoryNode('/bis/rollback-base','rollback-base',true)+'\\bis'+ActionList.id;
	//-- Check for registry files
	var x=bisDocument.selectNodes('/bis/registry/file/text()');
	if(x.length>0) {
		ActionList.registryFiles=[];
		ActionList.registryUndoFile='uninstall.reg';
		for(var i=0; i<x.length; i++) {
			ActionList.registryFiles[ActionList.registryFiles.length]=x[i].nodeValue;
			antireg(x[i].nodeValue,ActionList.registryUndoFile,i==0);
		}
	}
	//-- Proces the update files
	var update=bisDocument.selectNodes('/bis/update')
	for(var i=0; i<update.length; i++)
	{
		ActionList.fromBase=_GetDirectoryNodeNode(update[i],'from-base','from-base['+i+']');
		ActionList[ActionList.length]=new FromDir(ActionList.fromBase); //needed to change folder in batchfile
		ActionList.toBase=_GetDirectoryNodeNode(update[i],'to-base','to-base['+i+']'); //needed to change folder in batchfile
		ActionList[ActionList.length]=new ToDir(ActionList.toBase);
		_ProcesFromToFiles(ActionList,'');
	}
	return; //done
}
function _ProcesFromToFiles(ActionList,subdir) 
{
	if(subdir) subdir+='\\';
	var from=fso.GetFolder(ActionList.fromBase+'\\'+subdir);
	var ActionItem;
	var f,filename,foldername;
	var create,remove
	for(f=new Enumerator(from.Files); !f.atEnd(); f.moveNext()) {
		filename=f.item().Name;
		if(rxBisDelete.test(filename)) {
			create=false; 
			remove=true;
			filename=filename.replace(rxBisDelete,''); //remove extension .bis-delete
		}
		else {
			create=true; 
			remove=fso.FileExists(ActionList.toBase+'\\'+subdir+filename);
		}
		ActionItem=new FileSync(subdir+filename,subdir+filename,create,remove);
		if(rxDLL.test(filename)) { //*.dll: for registering in-proc activex servers
			ActionItem.SetRegSvr32();
		}
		ActionList[ActionList.length]=ActionItem;
	}
	for(var f=new Enumerator(from.SubFolders); !f.atEnd(); f.moveNext()) {
		//A folder can only be created or deleted. Modification is not possible, 
		//because it has no contents (only containing files, but they are handled recursively.
		//create: only a mkdir/rmdir command is issues
		//remove: a move 
		foldername=f.item().Name;
		if(rxBisDelete.test(foldername)) {
			foldername=foldername.replace(rxBisDelete,'');
			ActionList[ActionList.length]=new DirExpire(subdir+foldername);
			//add to action list
			continue; //no recursion, next folder
		}
		create=!fso.FolderExists(ActionList.toBase+'\\'+subdir+foldername);
		if(create) {
			//if source folder doesn't exist in destination, schedule it for creation
			//For use for installation
			ActionList[ActionList.length]=new DirCreate('\\'+subdir+foldername);
		}
		_ProcesFromToFiles(ActionList,subdir+foldername);
		if(create) {
			//remove, but after the file-processing (it's a rmdir, not a rmdir /s or deltree)
			//for use for uninstallation
			ActionList[ActionList.length]=new DirRemove('\\'+subdir+foldername);
		}
	}
}
function _ZeroPad(i,n) 
{
	i=''+i;
	while(i.length<n) i='0'+i;
	return i;
}
/*constructor*/ function FileSync(source,dest,create,remove)
{
	this.source=source;
	this.dest=dest;
	this.create=create;
	this.remove=remove;
	this.SetRegSvr32=function() { this.useRegSvr32=true; }
/*	D- inst: move to un        -C inst: copy . to         DC inst: move to un     
			 unin: move . to         	  unin: del to         		 	       copy . to      
																														 unin: del to         
																																	 move . to             */
	this.WriteToBatch=function(inst_Write,unin_Write,uninstallPrefix)
	{
		var uninstallName=uninstallPrefix+fso.GetFileName(this.dest);
		if(this.remove) {
			if(this.useRegSvr32) inst_Write('regsvr32.exe /s /u "%todir%\\'+this.dest+'"',false,true);
			inst_Write('move "%todir%\\'+this.dest+'" "%undir%\\'+uninstallName+'"',false,true);
		}
		if(this.create) {
			inst_Write('move "%fromdir%\\'+this.source+'" "%todir%\\'+this.dest+'"',false,true);
			if(this.useRegSvr32) inst_Write('regsvr32.exe /s "%todir%\\'+this.dest+'"',false,true);
			if(this.useRegSvr32) unin_Write('regsvr32.exe /s /u "%todir%\\'+this.dest+'"',false,true);
			unin_Write('move "%todir%\\'+this.dest+'" "%fromdir%\\'+this.source+'"',false,true);
		}
		if(this.remove) {
			unin_Write('move "'+uninstallName+'" "%todir%\\'+this.dest+'"',false,true);
			if(this.useRegSvr32) unin_Write('regsvr32.exe /s "%todir%\\'+this.dest+'"',false,true);
		}
	}
}
/*constructor*/ function DirExpire(folder)
{
	this.folder=folder;

	this.WriteToBatch=function(inst_Write,unin_Write,uninstallPrefix)
	{
		var uninstallName=uninstallPrefix+fso.GetFileName(this.folder);
		inst_Write('move "%todir%\\'+this.folder+'" "%undir%\\'+uninstallName+'"',false,true);
		unin_Write('move "'+uninstallName+'" "%todir%\\'+this.folder+'"',false,true);
	}
}
/*constructor*/ function DirCreate(folder)
{
	this.folder=folder;
	this.WriteToBatch=function(inst_Write,unin_Write)
	{
		inst_Write('mkdir "%todir%'+this.folder+'"',false,true);
	}

}
/*constructor*/ function DirRemove(folder)
{
	this.folder=folder;
	this.WriteToBatch=function(inst_Write,unin_Write)
	{
		unin_Write('rmdir "%todir%'+this.folder+'"',false,true);
	}
}

/*constructor*/ function FromDir(folder)
{
	this.folder=folder;
	this.WriteToBatch=function(inst_Write,unin_Write)
	{
		inst_Write('set fromdir='+this.folder,false,true);
		unin_Write('set fromdir='+this.folder,false,true);
	}
}
/*constructor*/ function ToDir(folder)
{
	this.folder=folder;
	this.WriteToBatch=function(inst_Write,unin_Write)
	{
		inst_Write('set todir='+this.folder,false,true);
		unin_Write('set todir='+this.folder,false,true);
	}
}

function _GetTextValue(xPath)
{
	var node=bisDocument.selectSingleNode(xPath);
	if(node==null) return '';
	else return node.nodeValue;
}
function _GetDirectoryNode(xPath,name,createIfNotExists)
{
	return _GetDirectoryNodeNode(bisDocument,xPath,name,createIfNotExists);
}
function _GetDirectoryNodeNode(node,xPath,name,createIfNotExists)
{
	var node=node.selectSingleNode(xPath);
	var dir;
	if(node==null) {
		Display($error,'The '+name+' tag is not found in the input');
	}
	if(node==null||node.childNodes.length==0) {
		dir=fso.GetAbsolutePathName(''); //current directory
	} 
	else {
		dir=fso.GetAbsolutePathName(node.firstChild.nodeValue);
	}
	if(!fso.FolderExists(dir)) {
		if(createIfNotExists) fso.CreateFolder(dir);
		else Display($error,'The folder '+dir+' (specified in the '+name+' tag) doesn\'t exist');
	}
	return dir;
}
//---| antireg |-----------------------------------------------------------------------------------
function antireg(filename,unfilename,createUndoFile)
//--@createUndoFile;type=boolean@create undo file when true, otherwise append
{
	var rfp=new RegFileParser(filename);
	var lastKey,fileValue,regValue,regType,inDeleteKey=false;
	var antiFile;
	if(createUndoFile) {
		antiFile=fso.OpenTextFile(unfilename,2,true,rfp.unicode)
		antiFile.WriteLine(rfp.getVersionString());
		antiFile.WriteLine();
	}
	else {
		antiFile=fso.OpenTextFile(unfilename,8,false,rfp.unicode)
	}
	while(rfp.readLine())	{
		if(rfp.error) {
			if(antiFile) {
				antiFile.WriteLine('; Error parsing line; line-type :'+$result[rfp.lastResult]);
				antiFile.WriteLine('; last key ['+rfp.key+']');
				antiFile.WriteLine('; reason :'+rfp.error);
				antiFile.WriteLine('; _line:::'+rfp._line+':::');
			}
			continue;
		}
		switch(rfp.lastResult) {
			case $result_heading: //never occurs here (this is the initial state after creation)
			case $result_eof:
			case $result_empty:			
				//nothing to do
				break;
			case $result_key:
				inDeleteKey=false;
				break;
			case $result_namevalue:
				fileValue=rfp.value;
				regValue=RegRead(rfp.key,rfp.name);
				if(!RegCmp(fileValue,regValue)) {
					//value from merge file differs from current registry value
					if(lastKey!=rfp.key) {
						//write key line
						lastKey=rfp.key;
						if(regValue==null && rfp.name==null) {
							//default value doesn't exist
							antiFile.WriteLine('[-'+lastKey+']');
							inDeleteKey=true;
						}
						else {
							antiFile.WriteLine('['+lastKey+']');
						}
					}
					if(regValue==null && rfp.name==null) {
						//nothing to do
					}
					else {
						if(!inDeleteKey) {
							regType=RegDetermineType(regValue);
							if(regType=='REG_SZ'&&rfp.type=='REG_EXPAND_SZ') regType='REG_EXPAND_SZ'; //educated guess
							if(regType=='unknown') {
								antiFile.WriteLine( '; Can\'t determine type of registry item '+rfp.key+'\\'+rfp.name );
							}
							else {
								//write undo line
								antiFile.WriteLine( RegEncode(rfp.name,regValue,regType) );
							}
						}
					}
				}
				break;
			default:
				antiFile.WriteLine( '; Error in registry merge file parser, lastResult is '+rfp.lastResult);
				break;
		}
	}
	antiFile.Close();
	rfp.done();
}

/*Description: reads the item from the registry, and translates to native javascript types.*/
/*returns: null when key is not found*/
/*known exceptions: 
  13: Type mismatch (problems converting win32 types to COM/VB/javascript (first call CanRegRead))
	1972: problems converting to native javascript type

"Invalid procedure call or argument": This error message can occur when a string value is returned by
egRead, and this value is used somewhere. This has happend with weird unicode-strings.
	*/
function RegRead(key,name)
{
	if(name==null) name=key+'\\';
	else name=key+'\\'+name;
	try {
		var item=shell.RegRead(name);
	}
	catch(ex)	{
		if(2==(ex.number&0xFFFF)) return null; //Not found
		WScript.Echo('Unknown exception, rethowing #'+(ex.number&0xFFFF)+': '+ex.description);
		throw ex; //unknown error
	}
	if(typeof item=='string') {
		if(name.substr(name.length-1)=='\\') {
			var indexOfNameInItem=item.indexOf(name);
			if(indexOfNameInItem!=-1 && indexOfNameInItem==item.length-name.length) {
				//when querying for default values, the keyname is sometimes appended to the value (within clsid branch most times)
				return item.substring(0,item.length-name.length);
			}
		}
		return item; //REG_SZ or REG_EXPAND_SZ
	}
	if(typeof item=='number') {
		//REG_DWORD
		if(item<0) {
			//there are some problems with dwords with some high bits set...
			return eval('0x'+ (item>>>8).toString(16)+((item&0xff)<=0xf?'0':'')+(item&0xff).toString(16));
		}
		else {
			return item; 
		}
	}
	if(typeof item=='unknown') {
		return new VBArray(item).toArray(); //REG_BINARY or REG_MULTI_SZ
	}
	throw new Error(0x07b4,'Unexpected javascript type "'+typeof item+'" read from registry item "'+name+'"');
}
/*compares values, returned by RegRead*/
function RegCmp(a,b)
{
	if(a==null && b==null) return true;
	if(typeof a!=typeof b) return false;
	if(typeof a!='object') return a==b;
	if(a instanceof Array && b instanceof Array) {
		if(a.length!=b.length) return false;
		for(var i=0; i<a.length; i++) {
			if(a[i]!=b[i]) return false;
		}
		return true;
	}
	return false;
}
//--| Determine REG_* type based on javascript type
function RegDetermineType(value)
{
	if(value==null) return null;
	if(typeof value=='string') return 'REG_SZ'; //it can also be 'REG_EXPAND_SZ', but ignore this fact.
	if(typeof value=='number') return 'REG_DWORD';
	if(typeof value=='object'&&value.constructor==Array) {
		if(typeof value[0]=='number') return 'REG_BINARY';
		if(typeof value[0]=='string') return 'REG_MULTI_SZ';
	}
	return 'unknown';
}

function RegEncode(name,value,type)
{
	var s=(name==null?'@':_encode_sz(name))+'=';
	if(value==null)	{
		s+='-';
	}
	else {
		switch(type) {
			case 'REG_DWORD': s+=_encode_dword(value); break;
			case 'REG_BINARY': s+=_encode_binary(value); break;
			case 'REG_SZ': s+=_encode_sz(value); break;
			case 'REG_EXPAND_SZ': s+=_encode_expand_sz(value); break;
			case 'REG_MULTI_SZ': s+=_encode_multi_sz(value); break;
			default: s='; unsuppored type '+type+' on keyname '+name; break; //unsupported
		}
	}
	return s;
}
function _encode_dword(v) {
	return 'dword:'+_ZeroPad(v.toString(16),8);
}
function _encode_binary(v) {
	return _encode_hex(v,'hex');
}
function _encode_sz(s) {
	return '"'+String(s).replace(/"/i,'"').replace(/\\/,'\\\\')+'"';
}
function _encode_expand_sz(v) {
	return _encode_hex(v,'hex(2)');
}
function _encode_multi_sz(v) {
	return _encode_hex(v,'hex(7)');
}
/*helper functions*/
function _encode_hex(v,t) {
	var a=[];
	for(var i=0; i<v.length; i++) {
		a[a.length]=_ZeroPad(v[i].toString(16),2);
	}
	return hexWrap(t+':'+a.join(','),80);
}
function hexWrap(s,n)
{
	var sep=',\\\n  ';
	var i=0,j=n-',00'.length;
	var a=[];
	while(true) {
		var j=s.indexOf(',',j);
		if(j==-1) break;
		a[a.length]=s.substring(i,j);
		i=j+1;
		j+=n-sep.length;
	}
	if(i<s.length) a[a.length]=s.substring(i);
	return a.join(sep);
}
function _ZeroPad(i,n) 
{
	i=''+i;
	while(i.length<n) i='0'+i;
	return i;
}
/****************************************************************************************************
Description: Parser for Windows registry merge files (Windows NT4 and 2000).
Constructor:
	-RegFileParser(filename): supply filename of the registry file. Everything is initialized, and the 
	 first call to readLine is performed, to determine the header.
Methods:
	-readLine(): returns type of line parsed:
	 $result_eof				end of file encountered
	 $result_heading		header line (initial value of .lastResult)
	 $result_empty			An empty line is encountered, nohting is done.
	 $result_key				A key line is read and parsed ([HKEY_LOCAL_MACHINE\...])
	 $result_namevalue	A name/value pair is read (name="value")
	-done(): call when done (for closing registry file)
	-getVersionString(): returns the .version property as string
Properties:
	-lastResult: same value as method readLine returned at last call
	-error: if readLine() was performed OK, this property contains null, otherwise a string with the error described
	[properties from lastResult==$result_heading]
	-unicode: if input file is unicode (true) or 8-bit characters (false; ASCII/iso-8859-1/win-1252/etc.)
	-version: version of registry file (4=NT4, 5=Win2K or XP)
	[properties from lastResult==$result_key]
	-key    : name of the key (string)
	-remove : true if .key needs to be removed
	[properties from lastResult==$result_namevalue]
	-name   : name of value (name=value), null if it's the default of the key (@="value")
	-value  : value (javascript null is used as remove marker)
	-type   : type of registry entry, see javascript type mapping in table below.
   REG_DWORD	    dword:0x00000000			number [unsigned 32 bit integer]
   REG_BINARY	    hex:00,00							array of number [unsigned 8 bit integer]
   REG_SZ	        "string\""						string
   REG_EXPAND_SZ  hex(2):99,00					string
   REG_MULTI_SZ   hex(7):99,00,88,00,00	array of string
   null	          -											remove name-value pair 
list of unsupported encodings:
-----------------------------
hex(0)		REG_NONE
hex(1)		REG_SZ
hex(3)		REG_BINARY
hex(4)		REG_DWORD
hex(5)		REG_DWORD_LITTLE_ENDIAN
hex(6)		REG_LINK
hex(8)		REG_RESOURCE_LIST
hex(9)		REG_FULL_RESOURCE_DESCRIPTOR
hex(a)		REG_RESOURCE_REQUIREMENT_LIST
hex(b)		REG_QWORD			
hex(c)		not implemented (type becomes 0xc)
hex(d)		not implemented (type becomes 0xd)
hex(e)		not implemented (type becomes 0xe)
hex(f)		not implemented (type becomes 0xf)

other bugs
----------
When a REG_SZ value has some kind of new-line character in it, it will be exported like
"name"="value
next line"

This will be skipped, when merged back into the registry. 
It's unknown which new-line character it is (it's a single character, though, and exported as 0x0d0a)
****************************************************************************************************/
/*constructor*/ function RegFileParser(filename)
{
	this.init=RegFileParser_init;
	this.done=RegFileParser_done;
	this.getVersionString=RegFileParser_getVersionString;
	this.readLine=RegFileParser_readLine;
	this._getValue=RegFileParser__getValue;
	this.toString=RegFileParser_toString;

	this.init(filename);
}
/*methods*/
function RegFileParser_init(filename)
{
	var unicode=true;
	if(!fso.FileExists(filename)) Display($error,'File "'+filename+'" doesn\'t exist.');
	this.filename=filename;
	this.input=fso.OpenTextFile(filename,1,false,unicode); //for reading, unicode
	this._line=this.input.ReadLine();
	if(!interpretHeading.call(this)) {
		unicode=false;
		this.input=fso.OpenTextFile(filename,1,false,unicode); //for reading, unicode
		this._line=this.input.ReadLine();
		if(!interpretHeading.call(this)) {
			Display($error,'Registry file has an unknown header ('+this._line+')');
		}
	}
	this.lastResult=$result_heading;
	return;
	
	function interpretHeading()
	{
		this.unicode=unicode; 
		switch(this._line) {
			case 'REGEDIT4': this.version=4; return true;
			case 'Windows Registry Editor Version 5.00': this.version=5; return true;
			default: return false;
		}
	}
}
function RegFileParser_getVersionString()
{
	if(typeof this.version=='undefined') return 'undetermined';
	if(this.version==4) return 'REGEDIT4';
	else if(this.version==5) return 'Windows Registry Editor Version 5.00';
	else return '; unknown version';
}
function RegFileParser_done()
{
	this.input.Close();
}
function RegFileParser_readLine()
{
	var rxEmpty=/^\s*$/;
	var rxKey=/^\[(-?)([^\]]+)\]$/;
	var rxMultiLine=/\\$/;
	var rxIndent=/^\s+/;
	var i,a;

	this.error=null;
	if(this.input.AtEndOfStream) {
		return this.lastResult=$result_eof;
	}
	this._line=this.input.ReadLine();
	/*when a line ends with backslash, some more is to get on the next line (remove indent)*/
	while(rxMultiLine.test(this._line)) {
		this._line=this._line.replace(rxMultiLine,this.input.ReadLine().replace(rxIndent,''));
	}

	if(rxEmpty.test(this._line)) {
		this.lastResult=$result_empty;
	}
	else if(rxKey.test(this._line)) {
		a=rxKey.exec(this._line);
		if(a.length!=3) {
			this.error='Error parsing key (found '+a.length+' entries in stead of 3)';
		}
		this.key=a[2];
		this.remove=a[1]=='-';
		this.lastResult=$result_key;
	}
	else {
		var res=/^\s*("((\\.|[^\\])*)"|@)\s*=\s*/.exec(this._line);
		if(res&&res.length==4) {
			if(res[1]=='@') this.name=null; //default value
			else this.name=res[2];
			this._posKeyValueSep=RegExp.lastIndex-1;
			//--| now get value (different encodings)
			this._getValue();
		}
		else {
			this.error='Name-value pair expected, not found.';
		}
		this.lastResult=$result_namevalue;
	}
	return this.lastResult;
}
/*encoding	alternate	type
	---------+---------+-----------------------------
	hex(0):							REG_NONE
	hex(1):		""				REG_SZ
	hex(2):							REG_EXPAND_SZ  
	hex(3):		hex:			REG_BINARY
	hex(4):		dword:		REG_DWORD
	hex(5):							REG_DWORD_LITTLE_ENDIAN
	hex(6):							REG_LINK
	hex(7):							REG_MULTI_SZ
	hex(8):							REG_RESOURCE_LIST
	hex(9):							REG_FULL_RESOURCE_DESCRIPTOR
	hex(a):							REG_RESOURCE_REQUIREMENT_LIST
	hex(b):							REG_QWORD			                    
	-                   remove entry                 */
function RegFileParser__getValue()
{
	if(this.error!=null) return;
	var hexTypeNames=
	{	'0':'REG_NONE'
	,	'1':'REG_SZ'
	,	'2':'REG_EXPAND_SZ'
	,	'3':'REG_BINARY'
	,	'4':'REG_DWORD'
	,	'5':'REG_DWORD_LITTLE_ENDIAN'
	,	'6':'REG_LINK'
	,	'7':'REG_MULTI_SZ'
	,	'8':'REG_RESOURCE_LIST'
	,	'9':'REG_FULL_RESOURCE_DESCRIPTOR'
	,	'a':'REG_RESOURCE_REQUIREMENT_LIST'
	,	'b':'REG_QWORD'
	};
	var prefix=['dword:','"','hex','-'];
	var hexSubType;
	this.value=this._line.substr(this._posKeyValueSep+1); //string after = sign
	for(var i=0; i<prefix.length; i++) {
		if(this.value.substr(0,prefix[i].length)==prefix[i]) {
			this.value=this.value.substring(prefix[i].length); //skipping prefix
			switch(i) { 
				case 0: //dword: (number [unsigned 32 bit integer])
					this.type='REG_DWORD';
					this.value=parseInt(this.value,16);
					return;
				case 1: //" (string)
					this.type='REG_SZ'; //string
					if(!/\"\s*$/.test(this.value)) {
						this.error='No closing quotes found on this line (new lines are illegal within quote-encoding)';
					}
					else {
						//get rid ending quote and unescape backslash escapes (\\, \')
						this.value=this.value.substr(0,this.value.length-1).replace(/\\(.)/g,'$1');
					}
					return;
				case 2: //hex:     (alternate encoding for REG_BINARY)
					if(this.value.substr(0,1)==':') { //hex:
						this.type='REG_BINARY';
						this.value=this.value.substr(1); 
					}
					else { //hex(x):     (hex encodings)
						hexSubType=/^\(([0-9ab])\):/i.exec(this.value);
						if(hexSubType==null) {
							this.error='Unrecognized hex encoding format of value';
							return;
						}
						else {
							this.value=this.value.substr('(x):'.length);
							this.type=hexTypeNames[hexSubType[1].toLowerCase()];
						}
					}
					//now interpret the data from this.value
					if(this.type=='REG_DWORD') {
						//Byte list is little endian
						if(!/^([0-9a-f]{2},){3}[0-9a-f]{2}$/i.test(this.value)) {
							this.error='The type REG_DWORD must exist of four comma seperated double-hex-digit byte entries';
							//--| RegEdit accepts list lengths (at least one byte), but displays (invalid DWORD value) in GUI
							//--| but reproduces the supplied byte sequence, though...
						}
						else {
							this.value=parseInt(this.value.split(',').reverse().join(''),16);
						}
					}
					else if(this.type=='REG_EXPAND_SZ' || this.type=='REG_SZ') {
						//Byte list is little-endian format
						//Convert word-sequence Aa,Bb,Cc,Dd,...,00,00 
						//to unicode string 0xBbAa + 0xDdCc + ...
						this.value=this.value.replace(/([0-9a-f]{2}),([0-9a-f]{2})/ig,'0x$2$1'); //make 16-bit words first
						if(!/0x0000$/i.test(this.value)) {
							this.error='The type REG_EXPAND_SZ must end with 00,00';
						}
						else {
							this.value=eval('String.fromCharCode('+this.value.replace(/,?(0x0000,)*0x0000$/,'')+')');
						}
					}
					else if(this.type=='REG_MULTI_SZ') {
						//Byte list is little-endian format
						//Convert word-sequence Aa,Bb,00,00,Cc,Dd,Ee,Ff,00,00...,00,00,00,00  
						//to array of unicode strings [0xBbAa,0xDdCc + 0xFfEe,...]
						//an empty list (00,00) becomes an empty array
						this.value=this.value.replace(/([0-9a-f]{2}),([0-9a-f]{2})/ig,'0x$2$1'); //make 16-bit words first
						if(/^(0x0000,)*0x0000$/i.test(this.value)) {
							this.value=[]; //empty list
						}
						else if(/0x0000,0x0000$/i.test(this.value)) { //ensure a filled list ends with two nul words
							this.value=eval('[String.fromCharCode('+this.value.replace(/(,0x0000)+,0x0000$/,'').replace(/,0x0000,/g,'),String.fromCharCode(')+')]');
						}
						else {
							this.error='The type REG_MULTI_SZ with one entry must be ended with 00,00,00,00';
						}
					}
					else {
						//(array of number [unsigned 8 bit integer])
						this.value=eval('['+this.value.replace(/([0-9a-f]{2})/ig,'0x$1')+']');
					}
					return;
				case 4: //- (null)
					this.type=null;
					if(this.value!='') {
						this.error='Unexpected characters after =- (deletion marker)';
					}
					this.value=null;
					return;
				default:
					this.error='Internal processing error';
					return;
			}
		}
	}
	this.error='Unrecognized encoding format of value';
}

function RegFileParser_toString()
{
	var a=['* _line   :::'+this._line+':::','  lastResult:'+$result[this.lastResult]+' ('+this.lastResult+')'];
	switch(this.lastResult)
	{
		case $result_heading:
			a[a.length]='  version   :'+this.version;
			a[a.length]='  unicode   :'+this.unicode;
			break;
		case $result_key:
			a[a.length]='  key       :'+this.key;
			a[a.length]='  remove    :'+this.remove;
			break;
		case $result_namevalue:
			a[a.length]='  type      :'+this.type;
			a[a.length]='  name      :'+this.name;
			a[a.length]='  value   :::'+this.value+':::';
			break;
	}
	return multi('_',111)+'\n'+a.join('\n');
}

function multi(s,n) {
	var res=''; if(n>0) while(n--) res+=s; return res;
}