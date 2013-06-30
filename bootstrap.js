/**
   The code in this file is a modification of the bootstrap.js file authored for the RTF/ODF-Scan for Zotero plugin:
   http://zotero-odf-scan.github.io/zotero-odf-scan/

   The original bootstrap.js file can be found here:
   https://github.com/Zotero-ODF-Scan/zotero-odf-scan/blob/master/plugin/bootstrap.js

   All credit for the structure and most boilerplate code in this file goes to the authors of the original bootstrap.js file.
*/

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const PREF_BRANCH = "extensions.zotero.";
const PREFS = {
    "PubPeer.optionName":"value",
    "PubPeer.booleanOptionName":false
};

function setDefaultPrefs() {
  let branch = Services.prefs.getDefaultBranch(PREF_BRANCH);
  for (let [key, val] in Iterator(PREFS)) {
    switch (typeof val) {
      case "boolean":
        branch.setBoolPref(key, val);
        break;
      case "number":
        branch.setIntPref(key, val);
        break;
      case "string":
        branch.setCharPref(key, val);
        break;
    }
  }
}

/**
 * Apply a callback to each open and new browser windows.
 *
 * @usage watchWindows(callback): Apply a callback to each browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function watchWindows(callback) {
    // Travelling object used to store original attribute values
    // needed for uninstall
    var tabCallbackInfo = {};
    // Wrap the callback in a function that ignores failures
    function watcher(window) {
        try {
            // Now that the window has loaded, only handle browser windows
            let {documentElement} = window.document;
            if (documentElement.getAttribute("windowtype") == "navigator:browser"
                || documentElement.getAttribute("windowtype") === "zotero:basicViewer") {
                var menuElem = window.document.getElementById('zotero-tb-actions-rtfScan');
                if (!menuElem) return;
                var cmdElem = window.document.getElementById("cmd_zotero_rtfScan");
	            var windowUtils = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		            .getInterface(Components.interfaces.nsIDOMWindowUtils);
	            var windowID = windowUtils.outerWindowID;
                tabCallbackInfo[windowID] = {
                    oldLabel:menuElem.getAttribute("label"),
                    oldRtfScanCommand:cmdElem.getAttribute("oncommand"),
                    children: {}
                }
                if (window.gBrowser && window.gBrowser.tabContainer) {

                    var tabContainer = window.gBrowser.tabContainer;

                    // Tab monitor callback wrapper. Sets aside enough information
                    // to shut down listeners on plugin uninstall or disable. Tabs in
                    // which Zotero/MLZ are not detected are sniffed at, then ignored
                    function tabSelect (event) {

                        // Capture a pointer to this tab window for use in the setTimeout,
                        // and make a note of the tab windowID (needed for uninstall)
                        var contentWindow = window.content;
	                    var windowUtils = contentWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		                    .getInterface(Components.interfaces.nsIDOMWindowUtils);
	                    var contentWindowID = windowUtils.outerWindowID;

                        // Only once for per tab in this browser window
                        if (tabCallbackInfo[windowID].children[contentWindowID]) return;

                        // Allow a little time for the window to start. If recognition
                        // fails on tab open, a later select will still pick it up
                        window.setTimeout(function(contentWindow,tabCallbackInfo,windowID,contentWindowID,callback) {
                            var menuElem = contentWindow.document.getElementById('zotero-tb-actions-rtfScan');
                            if (!menuElem) return;
                            // Children are Zotero tab instances and only one can exist
                            for (var key in tabCallbackInfo[windowID].children) {
                                delete tabCallbackInfo[windowID].children[key];
                            }
                            tabCallbackInfo[windowID].children[contentWindowID] = true;
                            callback(contentWindow);
                        }, 1000, contentWindow,tabCallbackInfo,windowID,contentWindowID,callback);
                    }

                    // Modify tabs
                    // tabOpen event implies tabSelect, so this is enough
                    tabContainer.addEventListener("TabSelect", tabSelect, false);

                    // Function to remove listener on uninstall
                    tabCallbackInfo[windowID].removeListener = function () {
                        tabContainer.removeEventListener("TabSelect", tabSelect);
                    }
                }

                // Modify the chrome window itself
                callback(window);
            }
        }
        catch(ex) {
            dump("ERROR (pubpeer-for-zotero): in watcher(): "+ex);
        }
    }

    // Wait for the window to finish loading before running the callback
    function runOnLoad(window) {
        // Listen for one load event before checking the window type
        // ODF Scan: run until we find both the main window and a tab ...
        window.addEventListener("load", function runOnce() {
            window.removeEventListener("load", runOnce, false);
            watcher(window);
        }, false);
    }

    // Add functionality to existing windows
    let windows = Services.wm.getEnumerator(null);
    while (windows.hasMoreElements()) {
        // Only run the watcher immediately if the window is completely loaded
        let window = windows.getNext();
        if (window.document.readyState == "complete") {
            watcher(window);
        } else {
            // Wait for the window to load before continuing
            runOnLoad(window);
        }
    }

    // Watch for new browser windows opening then wait for it to load
    function windowWatcher(subject, topic) {
        if (topic == "domwindowopened")
            runOnLoad(subject);
    }
    Services.ww.registerNotification(windowWatcher);

    // Make sure to stop watching for windows if we're unloading
    unload(function() {

        Services.ww.unregisterNotification(windowWatcher);

        function restoreRtfScan (win,oldStuff) {
            var menuElem = win.document.getElementById("zotero-tb-actions-rtfScan");
            if (!menuElem) return;
            var cmdElem = win.document.getElementById("cmd_zotero_rtfScan");
            menuElem.setAttribute("label",oldStuff.oldLabel);
            cmdElem.setAttribute("oncommand", oldStuff.oldRtfScanCommand);
        }

        try {
            let someWindow = Services.wm.getMostRecentWindow(null);
	        var windowUtils = someWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindowUtils);
            for (var windowID in tabCallbackInfo) {

                // Get our main window
                var win = windowUtils.getOuterWindowWithId(parseInt(windowID,10));
                if (!win) continue;

                // Remove listener
                tabCallbackInfo[windowID].removeListener();

                // Restore behaviour of RTF Scan in the chrome document pane
                restoreRtfScan(win, tabCallbackInfo[windowID]);

                // Tick through the affected child tabs of this browser window
                // restoring behaviour there too
                for (var contentWindowID in tabCallbackInfo[windowID].children) {

                    // Get content window
                    var contentWin = windowUtils.getOuterWindowWithId(parseInt(contentWindowID,10));
                    if (!contentWin) continue;

                    // Restore old behaviour
                    restoreRtfScan(contentWin, tabCallbackInfo[windowID]);
                }
            }
        } catch (e) {
            dump("ERROR (pubpeer-for-zotero): in unload(): "+e+"\n");
        }
        tabCallbackInfo = {};
    });
}


/**
 * Save callbacks to run when unloading. Optionally scope the callback to a
 * container, e.g., window. Provide a way to run all the callbacks.
 *
 * @usage unload(): Run all callbacks and release them.
 *
 * @usage unload(callback): Add a callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 *
 * @usage unload(callback, container) Add a scoped callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @param [node] container: Remove the callback when this container unloads.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 */
function unload(callback, container) {
    // Initialize the array of unloaders on the first usage
    let unloaders = unload.unloaders;
    if (unloaders == null)
        unloaders = unload.unloaders = [];

    // Calling with no arguments runs all the unloader callbacks
    if (callback == null) {
        unloaders.slice().forEach(function(unloader) unloader());
        unloaders.length = 0;
        return;
    }

    // The callback is bound to the lifetime of the container if we have one
    if (container != null) {
        // Remove the unloader when the container unloads
        container.addEventListener("unload", removeUnloader, false);

        // Wrap the callback to additionally remove the unload listener
        let origCallback = callback;
        callback = function() {
            container.removeEventListener("unload", removeUnloader, false);
            var tabContainer = container.gBrowser.tabContainer;
            tabContainer.removeEventListener("TabSelect", container.tabSelect);
            origCallback();
        }
    }

    // Wrap the callback in a function that ignores failures
    function unloader() {
        try {
            callback();
        }
        catch(ex) {}
    }
    unloaders.push(unloader);

    // Provide a way to remove the unloader
    function removeUnloader() {
        let index = unloaders.indexOf(unloader);
        if (index != -1)
            unloaders.splice(index, 1);
    }
    return removeUnloader;
}

function startPubPeer(window) {
    changeExtraColumnText(window);
    addPubPeerTab(window);
    overrideGetCellText(window);
    overrideViewItem(window);
}

function overrideViewItem(window) {
    var ZoteroItemPane = Components.classes["@mozilla.org/appshell/window-mediator;1"] .getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser").ZoteroItemPane;

    var viewItemOld = ZoteroItemPane.viewItem;

    ZoteroItemPane.viewItem = function(item, mode, index) {
        if (index <= 3){
            return viewItemOld.apply(this, [item, mode, index]);
        }
        else {
            var box = window.document.getElementById("zotero-editpane-pubpeer");
            ZoteroItemPane._lastItem = item;
            return;
        }
    }
}

function goToPubPeer(window) {
    var ZoteroPane = Components.classes["@mozilla.org/appshell/window-mediator;1"] .getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser").ZoteroPane;

    window.alert('goToPubPeer');

    try {

        var selected_items = ZoteroPane.getSelectedItems();
        var item = selected_items[0];

        window.alert(item.toString());

        var doi = item.getField('DOI');
        var pubPeerAddress = "http://api.pubpeer.com/v1/publications/"+doi+"?idType=doi&devkey=zotero";
        
        if (doi.length > 0){
            var xmlHttp = new window.XMLHttpRequest();
            var pubPeerURL = '';
            
            xmlHttp.onload=function()
            {
                if (xmlHttp.readyState==4 && xmlHttp.status==200)
                {
                    response = eval("("+xmlHttp.responseText+")");
                    pubPeerURL = response.url;
                }
            }
            
            xmlHttp.open( "GET", pubPeerAddress, true );
            xmlHttp.send( null );
            
            if (pubPeerURL.length > 0){
                window.open(pubPeerURL,'_blank');
            }
            else {
                window.alert('PubPeer for Zotero: no PubPeer page found for this item');
            }
        }
        else {
            window.alert('PubPeer for Zotero: this item does not have a valid DOI');
        }
    }
    catch (e){
        return;
    }
}

// function updatePubPeer(window) {
//     return 0;
// }

function changeExtraColumnText(window) {    
    var extra = window.document.getElementById("zotero-items-column-extra");
    extra.setAttribute("label", "PubPeer");
}

function getPubPeerContentForSelection(window) {
    var ZoteroPane = Components.classes["@mozilla.org/appshell/window-mediator;1"] .getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser").ZoteroPane;

    var selected_item = ZoteroPane.getSelectedItems()[0];

    if (selected_item == null){
        return 0;
    }

    var doi = selected_item.getField('DOI');

    if (doi.length > 0){
        for ( var i = 0; i < pp.length; i+=1 ){
            if ( pp[i].doi === doi ){
                return pp[i].counter; // DOI found in pp
            }
        }

        return 0; // DOI not found in pp
    }
    
    return 0; // selected item has no DOI
}

function addPubPeerTab(window) {
    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

    var itemTabbox = window.document.getElementById("zotero-view-tabbox");
    var tab = window.document.createElement("tab");
    tab.textContent = "PubPeer";
    itemTabbox.tabs.appendChild(tab);

    var panel = window.document.createElement("tabpanel");
    panel.setAttribute("id", "zotero-editpane-pubpeer"); // analogous to what Zotero calls the item, tags, and related boxes
    panel.setAttribute("flex", "1");

    var vbox = window.document.createElement("vbox");

    var commentsLabel = window.document.createElement("description");
    commentsLabel.setAttribute("id", "pubpeer-for-zotero-comments-label");
    //commentsLabel.setAttribute("control", "pubpeer-comments-count");
    //commentsLabel.setAttribute("textContent", "Number of PubPeer Comments:");
    commentsLabel.textContent = "Number of PubPeer Comments: " + String(getPubPeerContentForSelection(window));

    var pubPeerLink = window.document.createElement("description");
    pubPeerLink.setAttribute("id", "pubpeer-for-zotero-pubpeer-link");
    pubPeerLink.textContent = "No PubPeer URL found for this item.";
    pubPeerLink.setAttribute("width", "50px");
    pubPeerLink.setAttribute("style", "color:blue; cursor:pointer");
    vbox.appendChild(commentsLabel);
    vbox.appendChild(pubPeerLink);

    panel.appendChild(vbox);
    itemTabbox.tabpanels.appendChild(panel);
}

/**
 * Change the menu and slot in a new command
 */
function addPubPeer(window) {
    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

    // get toolbar menu
    var menu = window.document.getElementById("zotero-tb-actions-popup")

    // construct separator
    var separator = window.document.createElementNS(XUL_NS, "menuseparator");
    separator.setAttribute("id", "zotero-tb-actions-separator-pubPeer");

    menu.appendChild(separator);
    
    // construct start button
    var startPubPeerItem = window.document.createElementNS(XUL_NS, "menuitem");
    startPubPeerItem.setAttribute("id", "zotero-tb-action-startPubPeer");
    startPubPeerItem.setAttribute("label", "Start PubPeer");
    startPubPeerItem.setAttribute("command", startPubPeer(window));

    menu.appendChild(startPubPeerItem);

    // construct update button
    var updatePubPeerItem = window.document.createElementNS(XUL_NS, "menuitem");
    updatePubPeerItem.setAttribute("id", "zotero-tb-action-goToPubPeer");
    updatePubPeerItem.setAttribute("label", "Go To PubPeer");
    //updatePubPeerItem.addEventListener('onCommand', goToPubPeer(window));

    menu.appendChild(updatePubPeerItem);
}

function httpGet(theUrl, window)
{
    var xmlHttp = null;
    
    xmlHttp = new window.XMLHttpRequest();
    xmlHttp.open( "GET", theUrl, false );
    xmlHttp.send( null );
    return xmlHttp.responseText;
}

var pp = [{doi: '', counter: '', time: '', url: ''}];
var ppThreshold = 10;

function overrideGetCellText(window) {
    var Zotero = Components.classes["@zotero.org/Zotero;1"]
				// Currently uses only nsISupports
				//.getService(Components.interfaces.chnmIZoteroService).
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;

    var ZoteroPane = Components.classes["@mozilla.org/appshell/window-mediator;1"] .getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("navigator:browser").ZoteroPane;

    var getCellTextOld = Zotero.ItemTreeView.prototype.getCellText;
    Zotero.ItemTreeView.prototype.getCellText = function(row,column){
        if (column.id != "zotero-items-column-extra")
        {
            return getCellTextOld.apply(this, [row, column]);
            //return getCellTextOld.apply(getCellTextOld, [row, column]);
        }
        else
        {

            var item = this._getItemAtRow(row);
            var selected_items = ZoteroPane.getSelectedItems();
            var selected_item = selected_items[0];

            if (selected_item != null && item.getField('id') == selected_item.getField('id')){

                var doi = item.getField('DOI');
                
                var pubPeerAddress = "http://api.pubpeer.com/v1/publications/"+doi+"?idType=doi&devkey=zotero";
                
                if (doi.length > 0){
                    var doiFound = 0;
                    for ( var i = 0; i < pp.length; i+=1 ){
                        if ( pp[i].doi === doi ){
                            doiFound = 1;

                            if ( ((new Date()).getTime()-pp[i].time)/1000 > ppThreshold ){
                            
                                var xmlHttp = new window.XMLHttpRequest();
                            
                                xmlHttp.onload=function()
                                {
                                    if (xmlHttp.readyState==4 && xmlHttp.status==200)
                                    {
                                        response = eval("("+xmlHttp.responseText+")");
                                        pp[i].counter = response.total_comments;
                                        pp[i].url = response.url;

                                        // update PubPeer tab
                                        var commentsLabel = window.document.getElementById("pubpeer-for-zotero-comments-label");
                                        if (commentsLabel != null){
                                            commentsLabel.textContent = "Number of PubPeer Comments: " + String(pp[i].counter);
                                        }

                                        var pubPeerLink = window.document.getElementById("pubpeer-for-zotero-pubpeer-link");
                                        if (pubPeerLink != null){
                                            pubPeerLink.textContent = String(pp[i].url);
                                            pubPeerLink.setAttribute("onclick", "window.open('"+pp[i].url+"'), '_blank'");
                                        }
                                    }
                                }

                                xmlHttp.open( "GET", pubPeerAddress, true );
                                xmlHttp.send( null );
                                
                                pp[i].time = (new Date()).getTime();
                            }
                    
                            return pp[i].counter;
                        }
                    }
                    
                    if (doiFound == 0){
                        pp.push({doi: doi, counter: '***', time: (new Date()).getTime()});
                        var i = pp.length-1;
                        var xmlHttp = new window.XMLHttpRequest();
                        
                        xmlHttp.onload=function()
                        {
                            if (xmlHttp.readyState==4 && xmlHttp.status==200)
                            {
                                response = eval("("+xmlHttp.responseText+")");
                                pp[i].counter = response.total_comments;
                                pp[i].url = response.url;

                                // update PubPeer tab
                                var commentsLabel = window.document.getElementById("pubpeer-for-zotero-comments-label");
                                if (commentsLabel != null){
                                    commentsLabel.textContent = "Number of PubPeer Comments: " + String(pp[i].counter);
                                }
                                                                
                                var pubPeerLink = window.document.getElementById("pubpeer-for-zotero-pubpeer-link");
                                if (pubPeerLink != null){
                                    pubPeerLink.textContent = String(pp[i].url);
                                    pubPeerLink.setAttribute("onclick", "window.open('"+pp[i].url+"'), '_blank'");
                                }
                            }
                        }

                        xmlHttp.open( "GET", pubPeerAddress, true );
                        xmlHttp.send( null );
                        
                        pp[i].time = (new Date()).getTime();
                        
                        return pp[i].counter;
                    }
                }
                else {
                    return '---';
                }
            }
            else {
                var doi = item.getField('DOI');
                if(doi.length > 0){
                    for ( var i = 0; i < pp.length; i+=1 ){
                        if ( pp[i].doi === doi ){
                            return pp[i].counter;
                        }
                    }
                    return '---';
                }
                else {
                    return '---';
                }
            }

            // else {
            //     return '---';
            // }

            // $.get(
            //     pubPeerAddress,
            //     function(data) {
            //         pubPeerQuery = $.parseJSON(data);
            //         //alert('total number of comments: '+ pubPeerQuery.total_comments);
            //     }
            // );
            
            // if (typeof totalCommentsElement === 'number')
            //     return totalCommentsElement;
            // else
            //     return '---';
        }
    }

}


/**
 * Handle the add-on being activated on install/enable
 */
function startup(data, reason) {
    // Shift all open and new browser windows
    setDefaultPrefs();
    watchWindows(addPubPeer);
    //watchWindows(changeExtraColumnText);
    //watchWindows(overrideGetCellText);
    //watchWindows(addPubPeerTab);
}

/**
 * Handle the add-on being deactivated on uninstall/disable
 */
function shutdown(data, reason) {
    // Clean up with unloaders when we're deactivating
    if (reason != APP_SHUTDOWN)
        unload();
}

/**
 * Handle the add-on being installed
 */
function install(data, reason) {}

/**
 * Handle the add-on being uninstalled
 */
function uninstall(data, reason) {}
