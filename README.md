pubpeer-for-zotero Development
==============================

## Basis of Code

The code in this development branch is based on the [Zotero-ODF-Scan](https://github.com/Zotero-ODF-Scan/zotero-odf-scan)
extension -- all credit for getting our extension off the ground goes to the authors of Zotero-ODF-Scan.

## The Development Branch

This is the development branch of the pubpeer-for-zotero extension.

**Please consider contributing by working to resolve our [current list of issues](https://github.com/pubpeer-for-zotero/pubpeer-for-zotero/issues).**

This extension is still in development and all code currently resides
in this dedicated development branch.
Once the extension is usable the development branch will be merged
with the master branch to prepare for release of the extension.

### Obtaining and Testing the Extension

To test this extension, clone into the repository

    $ git clone git@github.com:pubpeer-for-zotero/pubpeer-for-zotero.git

switch to the development branch

    $ git checkout development

create a ZIP archive that contains files `chrome.manifest`, `install.rdf`, and `bootstrap.js` and change
the extension of the resultant ZIP archive to `.xpi`.

In Firefox (you need to have Zotero installed), direct the Add-On manager to this `.xpi` file to install the extension.

## Resources for Extension Development

If you are interested in helping with development, read [these instructions](http://blog.mozilla.org/addons/2009/01/28/how-to-develop-a-firefox-extension/)
to get yourself started.
