/*jslint vars: true, plusplus: true, nomen: true, devel: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, FileReader, Mustache */

//TODO - define an Array with Messages - not so messy
define(function (require, exports, module) {
    "use strict";

    var panelHtml = require("text!html/panel.html"),
        swatchHtml = require("text!html/colors.html"),
        acoHtml = require("text!html/aco.html"),
        loadacoHtml = require("text!html/loadaco.html"),

        Aco = require("thirdparty/aco"),
        AppInit = brackets.getModule('utils/AppInit'),
        Dialogs = brackets.getModule("widgets/Dialogs"),
        Menus = brackets.getModule("command/Menus"),
        CommandManager = brackets.getModule("command/CommandManager"),
        PanelManager = brackets.getModule("view/PanelManager"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        StringUtils = brackets.getModule("utils/StringUtils"),
        FileViewController = brackets.getModule("project/FileViewController"),

        actualFile,
        loaded = false,

        app = {
            ID: "swatcher.run",
            SHORTCUT: "F11",
            PANEL: "#swatcher",
            CSS: "css/swatcher.css",
            MENULABEL: "Swatcher",
            MENULOCATION: Menus.AppMenuBar.VIEW_MENU
        };

    /*
        Build an Imagepath via Filename and parentpath of current document
    */
    function _getBgPath(str, currentDocument) {
        var os = brackets.platform.indexOf('win') ? 'file:///' : '/',
            root = os + currentDocument.file._parentPath;

        return str.slice(0, 1) + root + str.slice(1 + Math.abs(0));
    }

    /*
        Handle the Contextmenu checksign and open/close Panel
    */
    function _handleActive() {
        if (!CommandManager.get(app.ID).getChecked()) {
            CommandManager.get(app.ID).setChecked(true);
            $(app.PANEL).show();
            EditorManager.resizeEditor();
        } else {
            CommandManager.get(app.ID).setChecked(false);
            $(app.PANEL).hide();
            EditorManager.resizeEditor();
            EditorManager.focusEditor();
        }
    }

    /*
        Inserts String into focused editor
    */
    function _insert(editor, str) {
        if (editor) {
            var document = editor.document;

            if (editor.getSelectedText().length > 0) {
                var selection = editor.getSelection();
                document.replaceRange(str, selection.start, selection.end);
            } else {
                var pos = editor.getCursorPos();
                document.replaceRange(str, {
                    line: pos.line,
                    ch: pos.ch
                });
            }
        }
    }

    /*
        Go to a specific Line of a File
    */
    function _gotoLine(file, line) {
        FileViewController.addToWorkingSetAndSelect(file, FileViewController.WORKING_SET_VIEW);
        EditorManager.getCurrentFullEditor().setCursorPos(line, 0);
    }

    /*
        Bottompanel, MainView
        Parse Less Variables from current Document via Regex and prepare the data-tags for HTML
        Since you can insert in every File you want, we need raw CSS Styles and LESS variables as data-tags

        @style = actual visualisation of the Swatch
        @hex = CSS Property or Colorhash of the Swatch
        @less = LESS Variablename
        @line = Linenumber where variable was defined        
        @label = The Label of the Swatch
        
    */
    function swatchesFromLess(currentDocument) {
        if (currentDocument !== null && typeof (currentDocument) !== 'string') {

            // set global Variable
            actualFile = currentDocument.file.fullPath;

            var label, hex, found, entity, style,
                lessName, lessVal, panelData = [],
                documentText = currentDocument.getText(),
                documentLines = StringUtils.getLines(documentText);

            // (alnum - _)(:)(#HEX) OR (alnum - _)(:)('all chars')
            // @myvar:#FF0000; OR @myvar:'img/mypic.png';
            var regex = /@[0-9a-z\-_]{3,25}\s*:\s*('.*'|#[0-9a-f]{3,6})/ig;

            while ((found = regex.exec(documentText)) !== null) {

                entity = found[0].split(":");
                lessName = $.trim(entity[0]);
                lessVal = $.trim(entity[1]);

                if (lessVal[0] === '#') {

                    style = 'background-color:' + lessVal;
                    hex = lessVal;
                    label = hex;

                } else {

                    style = "background: url(" + _getBgPath(lessVal, currentDocument) + ") no-repeat center center #252525;background-size: 90%;";
                    hex = 'background-image: url(' + lessVal + ');';
                    label = '[img]';

                }

                panelData.push({
                    line: StringUtils.offsetToLineNum(documentLines, found.index),
                    less: lessName,
                    hex: hex,
                    label: label,
                    style: style
                });
            }

            return {
                wrap: panelData
            };
        }
    }

    /*
        Bottompanel, ACO View
        Render Bottompanel for ACO Colorname defining
        
        @style = actual visualisation of the Swatch
        @hex = Colorhash from Acolib
        @less = defineable LESS Variable Name
    */
    function panelFromAco(acoPalette) {
        var name, str = "",
            panelData = [];

        acoPalette.forEach(function (obj, i) {
            if (obj.hash) {
                name = '@color' + i;
                str += name + ":" + obj.hash + "; \n";

                panelData.push({
                    less: '@color' + i,
                    hex: obj.hash,
                    style: 'background-color:' + obj.hash
                });
            }
        });

        var html = Mustache.render(acoHtml, {
            wrap: panelData
        });

        $('#swatcher-container').empty().append(html);
    }

    /*
        Bottompanel, Main View
        Render Bottompanel with color definitons from LESS File [swatchesFromLess()]
    */
    function panelFromLess(editor) {
        if (editor) {
            var data = swatchesFromLess(editor.document),
                html = Mustache.render(swatchHtml, data);

            $('#swatcher-container').empty().append(html);
        }
    }

    /*
      Bottompanel, ACO View
      Insert Data from ACO View [panelFromAco()] into current Editor
      and refresh the Swatcher Main Panel
    */
    function acoToLess(editor) {
        if (editor) {
            var ext = editor.document.language._mode,
                str = "";

            $('#swatcher-prepare tr').each(function () {
                if ($(this).data('hex')) {
                    str += $(this).find('input').val() + ":" + $(this).data('hex') + "; \n";
                }
            });

            switch (ext) {
            case 'css':
                str = '/* Generated by Brackets Swatcher' + "\n" + str + '*/';
                break;

            case 'less':
                str = '/* Generated by Brackets Swatcher */' + "\n" + str;
                break;

            default:
                alert("You can only Insert Swatches on a LESS or CSS Document");
                return false;
            }

            // Insert Less String and Refresh Panel
            _insert(editor, str);
            panelFromLess(editor);

        } else {

            alert("Please Focus a Line of a CSS/LESS Document to Insert Swatches");

        }
    }

    /*
        Register Change/Click Events
    */
    function registerListener(instance) {

        /*
            BottomPanel, Mainview
            Click on a Swatch - get current Editor, get Filextension of current File in Editor and
            Paste the less variable OR the CSS Property
        */
        instance.on('click', '.swatcher-color', function () {
            var insert, editor = EditorManager.getFocusedEditor(),
                ext = editor.document.language._mode;
            if (ext === 'less') {
                insert = $(this).data("less");
            } else {
                insert = $(this).data("hex");
            }
            _insert(editor, insert);
        });

        /*
            BottomPanel, Top/Constant
            Parse Swatches from current Editor
        */
        instance.on('click', '.swatcher-parse', function () {
            var editor = EditorManager.getFocusedEditor(),
                ext = editor.document.language._mode;

            if (ext === 'css' || ext === 'less') {
                panelFromLess(editor);
            } else {
                alert('Please use a CSS or LESS File to parse Swatches');
                return false;
            }
        });

        /*
            BottomPanel, Top/Constant
            Click on the Label of a Swatch -> go to the Line where the LESS var is defined (also switches document)
            @actualFile = gets globally set from swatchesFromLess()
        */
        instance.on('click', '.swatcher-label', function () {
            _gotoLine(actualFile, $(this).data("line"));
        });

        /*
            BottomPanel, Top/Constant
            Inserts less.js from a CDN also inserts a sample stylesheet/less Tag
            For easier Live Development
        */
        instance.on('click', '.swatcher-insertJS', function () {
            var head = '<link rel="stylesheet/less" type="text/css" href="styles.less" /> \n <script type="text/javascript" src="http://cdnjs.cloudflare.com/ajax/libs/less.js/1.6.1/less.min.js"></script>';
            _insert(EditorManager.getFocusedEditor(), head);
        });

        /*
            BottomPanel, Top/Constant
            Panel closer
        */
        instance.on('click', '.close', function () {
            _handleActive();
        });

        //ENHANCE: Maybe some fancy Transitions, Disabled/Enabled State 
        /*
            Bottompanel, Top/Constant
            Keylistener, when length of inputfield is > 2 the Filter kicks in
        */
        instance.on('keyup', '.filter', function () {
            if ($(this).val().length > 2) {
                $('.swatcher-colorwrap').hide().find('div[data-less*="' + $(this).val() + '"]').parent().show();
            } else {
                $('.swatcher-colorwrap').show();
            }
        });

        //TODO: Bad Selector Name
        /*
            BottomPanel, Top/Constant
            Fires up the Aco Loader Dialog Modal
        */
        instance.on('click', '.swatcher-toggle', function () {
            var compiledTemplate = Mustache.render(loadacoHtml),
                dialog = Dialogs.showModalDialogUsingTemplate(compiledTemplate),
                $dialog = dialog.getElement(),
                palette;

            //TODO: button.primary = bad
            /*
                ACO Modal
                OnChange Event at File Input use HTML5 FileReader API at onloaded event to get
                a binaryString for the thirdparty/aco library to parse binary Photoshop Aco Palette
            */
            $dialog.on('change', '#swatcher-file', function () {
                var fr = new FileReader();
                fr.onloadend = function () {
                    palette = Aco.getPalette(this.result);
                    // We cant use aco.colnum because that property can be from all colorspaces - we just want RGB (prevented in lib)
                    if (palette.length > 0) {
                        $dialog.find('.swatcher-file-status').html('Swatcher Found <strong>' + palette.length + '</strong> parseable RGB Swatches');
                        $dialog.find('button.primary').attr('disabled', false);
                    } else {
                        $dialog.find('.swatcher-file-status').html('<strong style="color:red">Swatcher cant parse any Swatches <br> Please make sure the Swatches are in RGB Format</strong>');
                        $dialog.find('button.primary').attr('disabled', 'disabled');
                    }

                };
                fr.readAsBinaryString(this.files[0]);
            });

            //TODO button.primary = bad
            /*
                ACO Modal
                Load the current gotten Palette (from ACO Lib) into the Bottom Panel for defining LESS variable Names
            */
            $dialog.find("button.primary").on("click", function () {
                panelFromAco(palette);
                $('.swatcher-insless').show();
            });
        });

        /*
            Bottompanel, ACO View
            "Import into current Editor" [acoToLess()]
        */
        instance.on('click', '.swatcher-acoInsert', function () {
            acoToLess(EditorManager.getFocusedEditor());
        });

        /*
            Bottompanel, ACO View
            Cancel Import of Aco Palette
        */
        instance.on('click', '.swatcher-acoCancel', function () {
            $('#swatcher-container').empty();
        });

        loaded = true;
    }

    /*
        Init the Extension
    */
    var _init = function () {
        ExtensionUtils.loadStyleSheet(module, app.CSS);

        var $swatcher = $(Mustache.render(panelHtml));

        if (!loaded) {
            registerListener($swatcher);
        }

        PanelManager.createBottomPanel(app.ID, $swatcher, 200);
        _handleActive();
    };

    AppInit.appReady(function () {
        var m = Menus.getMenu(app.MENULOCATION);
        CommandManager.register(app.MENULABEL, app.ID, _init);
        m.addMenuItem(app.ID, app.SHORTCUT);
    });
});