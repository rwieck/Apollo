require({
           packages: [
               { name: 'jqueryui', location: '../plugins/WebApollo/jslib/jqueryui' },
               { name: 'jquery', location: '../plugins/WebApollo/jslib/jquery', main: 'jquery' }
           ]
       },
       [],
       function() {

define.amd.jQuery = true;

define(
       [
           'dojo/_base/declare',
           'dojo/_base/lang',
           'dojo/dom-construct',
           'dojo/dom-class',
           'dojo/_base/window',
           'dojo/_base/array',
           'dijit/Menu',
           'dijit/MenuItem',
           'dijit/MenuSeparator',
           'dijit/CheckedMenuItem',
           'dijit/PopupMenuItem',
           'dijit/form/DropDownButton',
           'dijit/DropDownMenu',
           'dijit/form/Button',
           'JBrowse/Plugin',
           'WebApollo/FeatureEdgeMatchManager',
           'WebApollo/FeatureSelectionManager',
           'WebApollo/TrackConfigTransformer',
           'WebApollo/View/Track/AnnotTrack',
           'WebApollo/View/TrackList/Hierarchical',
           'WebApollo/View/TrackList/Faceted',
           'WebApollo/InformationEditor',
           'WebApollo/View/Dialog/Help',
           'JBrowse/View/FileDialog/TrackList/GFF3Driver',
           'JBrowse/CodonTable',
           'lazyload/lazyload'
       ],
    function( declare,
            lang,
            domConstruct,
            domClass,
            win,
            array,
            dijitMenu,
            dijitMenuItem,
            dijitMenuSeparator,
            dijitCheckedMenuItem,
            dijitPopupMenuItem,
            dijitDropDownButton,
            dijitDropDownMenu,
            dijitButton,
            JBPlugin,
            FeatureEdgeMatchManager,
            FeatureSelectionManager,
            TrackConfigTransformer,
            AnnotTrack,
            Hierarchical,
            Faceted,
            InformationEditor,
            HelpMixin,
            GFF3Driver,
            CodonTable,
            LazyLoad ) {

return declare( [JBPlugin, HelpMixin],
{

    constructor: function( args ) {
        console.log("loaded WebApollo plugin");
        var thisB = this;
        this.searchMenuInitialized = false;
        var browser = this.browser;  // this.browser set in Plugin superclass constructor
        var externals=[
          'plugins/WebApollo/jslib/bbop/bbop.js',
          'plugins/WebApollo/jslib/bbop/golr.js',
          'plugins/WebApollo/jslib/bbop/jquery.js',
          'plugins/WebApollo/jslib/bbop/search_box.js'
        ];
        array.forEach(externals,function(src) {
          var script = document.createElement('script');
          script.src = src;
          script.async = false;
          document.head.appendChild(script);
        });

        // Checking for cookie for determining the color scheme of WebApollo
        if (browser.cookie("Scheme")=="Dark") {
            domClass.add(win.body(), "Dark");
            LazyLoad.css('plugins/WebApollo/css/maker_darkbackground.css');
        }

        browser.subscribe('/jbrowse/v1/n/tracks/visibleChanged', dojo.hitch(this,"updateLabels"));




        if (browser.config.favicon) {
            // this.setFavicon("plugins/WebApollo/img/webapollo_favicon.ico");
            this.setFavicon(browser.config.favicon);
        }

        args.cssLoaded.then( function() {
            if (! browser.config.view) { browser.config.view = {}; }
            browser.config.view.maxPxPerBp = thisB.getSequenceCharacterSize().width;
        } );

        if (! browser.config.helpUrl)  {
            browser.config.helpUrl = "http://genomearchitect.org/webapollo/docs/help.html";
        }

        // hand the browser object to the feature edge match manager
        FeatureEdgeMatchManager.setBrowser( browser );

        this.featSelectionManager = new FeatureSelectionManager();
        this.annotSelectionManager = new FeatureSelectionManager();
        this.trackTransformer = new TrackConfigTransformer();

        // setting up selection exclusiveOr --
        //    if selection is made in annot track, any selection in other tracks is deselected, and vice versa,
        //    regardless of multi-select mode etc.
        this.annotSelectionManager.addMutualExclusion(this.featSelectionManager);
        this.featSelectionManager.addMutualExclusion(this.annotSelectionManager);

        FeatureEdgeMatchManager.addSelectionManager(this.featSelectionManager);
        FeatureEdgeMatchManager.addSelectionManager(this.annotSelectionManager);

        this.addNavigationOptions();

        // add a global menu option for setting CDS color
        var cds_frame_toggle = new dijitCheckedMenuItem(
                {
                    label: "Color by CDS frame",
                    checked: browser.cookie("colorCdsByFrame")=="true"?true:false,
                    onClick: function(event) {
                        browser.cookie("colorCdsByFrame", this.get("checked")?"true":"false");
                        browser.view.redrawTracks();
                    }
                });
        browser.addGlobalMenuItem( 'view', cds_frame_toggle );

        var css_frame_menu = new dijitMenu();

        css_frame_menu.addChild(
            new dijitMenuItem({
                    label: "Light",
                    onClick: function (event) {
                        browser.cookie("Scheme","Light");
                        window.location.reload();
                    }
                }
            )
        );
        css_frame_menu.addChild(
            new dijitMenuItem({
                    label: "Dark",
                    onClick: function (event) {
                        browser.cookie("Scheme","Dark");
                        window.location.reload();
                    }
                }
            )
        );


        var css_frame_toggle = new dijitPopupMenuItem(
            {
                label: "Color Scheme"
                ,popup: css_frame_menu
            });

        browser.addGlobalMenuItem('view', css_frame_toggle);

        this.addStrandFilterOptions();
        var hide_track_label_toggle = new dijitCheckedMenuItem(
            {
                label: "Show track label",
                checked: browser.cookie("showTrackLabel"),
                onClick: function(event) {
                    browser.cookie("showTrackLabel",this.get("checked")?"true":"false");
                    thisB.updateLabels()
                }
            });
        browser.addGlobalMenuItem( 'view', hide_track_label_toggle);
        browser.addGlobalMenuItem( 'view', new dijitMenuSeparator());


            
        if(!browser.config.quickHelp)
        {
            browser.config.quickHelp = {
                "title": "Web Apollo Help",
                "content": this.defaultHelp()
            }
        };

        // register the WebApollo track types with the browser, so
        // that the open-file dialog and other things will have them
        // as options
        browser.registerTrackType({
            type:                 'WebApollo/View/Track/DraggableHTMLFeatures',
            defaultForStoreTypes: [ 'JBrowse/Store/SeqFeature/NCList',
                                    'JBrowse/Store/SeqFeature/GFF3',
                                    'WebApollo/Store/SeqFeature/ApolloGFF3'
                                  ],
            label: 'WebApollo Features'
        });
        browser.registerTrackType({
            type:                 'WebApollo/View/Track/DraggableAlignments',
            defaultForStoreTypes: [
                                    'JBrowse/Store/SeqFeature/BAM'
                                  ],
            label: 'WebApollo Alignments'
        });
        browser.registerTrackType({
            type:                 'WebApollo/View/Track/SequenceTrack',
            defaultForStoreTypes: [ 'JBrowse/Store/Sequence/StaticChunked' ],
            label: 'WebApollo Sequence'
        });

        // transform track configs from vanilla JBrowse to WebApollo:
        // type: "JBrowse/View/Track/HTMLFeatures" ==> "WebApollo/View/Track/DraggableHTMLFeatures"
        //
        array.forEach(browser.config.tracks,function(e) { thisB.trackTransformer.transform(e); });

        // update track selector to WebApollo's if needed
        // if no track selector set, use WebApollo's Hierarchical selector
        if (!browser.config.trackSelector) {
            browser.config.trackSelector = { type: 'WebApollo/View/TrackList/Hierarchical' };
        }
        // if using JBrowse's Hierarchical selector, switch to WebApollo's
        else if (browser.config.trackSelector.type == "Hierarchical") {
            browser.config.trackSelector.type = 'WebApollo/View/TrackList/Hierarchical';
        }
        // if using JBrowse's Hierarchical selector, switch to WebApollo's
        else if (browser.config.trackSelector.type == "Faceted") {
            browser.config.trackSelector.type = 'WebApollo/View/TrackList/Faceted';
        }

        // put the WebApollo logo in the powered_by place in the main JBrowse bar
        browser.afterMilestone( 'initView', function() {
            // dojo.connect( browser.browserWidget, "resize", thisB, 'onResize' );
            if (browser.poweredByLink)  {
                dojo.disconnect(browser.poweredBy_clickHandle);
                browser.poweredByLink.innerHTML = '<img src=\"plugins/WebApollo/img/ApolloLogo_100x36.png\" height=\"25\" />';
                browser.poweredByLink.href = 'http://genomearchitect.org/';
                browser.poweredByLink.target = "_blank";
            }

            // Initialize information editor with similar style to track selector
            var view = browser.view;
            view.oldOnResize = view.onResize;

             /* trying to fix residues rendering bug when web browser scaling/zoom (Cmd+, Cmd-) is used
              *    bug appears in Chrome, not Firefox, unsure of other browsers
              */
            view.onResize = function() {
                var fullZoom = (view.pxPerBp >= view.maxPxPerBp);
                var centerBp = Math.round((view.minVisible() + view.maxVisible())/2);
                var oldCharSize = thisB.getSequenceCharacterSize();
                var newCharSize = thisB.getSequenceCharacterSize(true);
                // detect if something happened to change pixel size of residues font (likely a web browser zoom)
                var charWidthChanged = (newCharSize.width != oldCharSize.width);
                var charWidth = newCharSize.width;
                if (charWidthChanged) {
                    if (! browser.config.view) { browser.config.view = {}; }
                    browser.config.view.maxPxPerBp = charWidth;
                    view.maxPxPerBp = charWidth;
                }
                if (charWidthChanged && fullZoom) {
                    view.pxPerBp = view.maxPxPerBp;
                    view.oldOnResize();
                    thisB.browserZoomFix(centerBp);
                }
                else  {
                    view.oldOnResize();
                }
            };

            var customGff3Driver = dojo.declare("ApolloGFF3Driver", GFF3Driver,   {
                constructor: function( args ) {
                    this.storeType = 'WebApollo/Store/SeqFeature/ApolloGFF3';
                }
            });
            browser.fileDialog.addFileTypeDriver(new customGff3Driver());

            if(browser.config.show_nav||browser.config.show_menu) {
                var help=dijit.byId("menubar_generalhelp");
                help.set("label", "Web Apollo Help");
                help.set("iconClass", null);
                var jbrowseUrl = "http://jbrowse.org";
                browser.addGlobalMenuItem( 'help',
                                        new dijitMenuItem(
                                            {
                                                id: 'menubar_powered_by_jbrowse',
                                                label: 'Powered by JBrowse',
                                                // iconClass: 'jbrowseIconHelp', 
                                                onClick: function()  { window.open(jbrowseUrl,'help_window').focus(); }
                                            })
                                      );
                browser.addGlobalMenuItem( 'help',
                    new dijitMenuItem(
                        {
                            id: 'menubar_web_service_api',
                            label: 'Web Service API',
                            // iconClass: 'jbrowseIconHelp',
                            onClick: function()  { window.open("../web_services/web_service_api.html",'help_window').focus(); }
                        })
                );
                browser.addGlobalMenuItem( 'help',
                    new dijitMenuItem(
                        {
                            id: 'menubar_apollo_version',
                            label: 'Get Version',
                            // iconClass: 'jbrowseIconHelp',
                            onClick: function()  {
                                window.open("../version.jsp",'help_window').focus();
                            }
                        })
                );
            }



        });
        this.monkeyPatchRegexPlugin();


    },
    updateLabels: function() {
        if(this.browser.cookie("showTrackLabel")=="false") {
            $('.track-label').hide();
        }
        else {
            $('.track-label').show();
        }
    },

    /**
     *  Hack to try and fix residues rendering bug when web browser scaling/zoom (Cmd+, Cmd-) is used
     *    bug appears in Chrome, not Firefox, unsure of other browsers
     *    based on GenomeView.zoomToBaseLevel(), GenomeView.updateZoom(), then stripping away unneeded
    */
    browserZoomFix: function(pos) {
        var view = this.browser.view;
        if (view.animation) return;
        var baseZoomIndex = view.zoomLevels.length - 1;
        var zoomLoc = 0.5;
        view.showWait();
        view.trimVertical();
        var relativeScale = view.zoomLevels[baseZoomIndex] / view.pxPerBp;
        var fixedBp = pos;
        view.curZoom = baseZoomIndex;
        view.pxPerBp = view.zoomLevels[baseZoomIndex];
        view.maxLeft = (view.pxPerBp * view.ref.end) - view.getWidth();

        // needed, otherwise Density track can render wrong
        //    possibly would have problems with other Canvas-based tracks too, though haven't seen in XYPlot yet
        for (var track = 0; track < view.tracks.length; track++)
            view.tracks[track].startZoom(view.pxPerBp,
                                         fixedBp - ((zoomLoc * view.getWidth())
                                                    / view.pxPerBp),
                                         fixedBp + (((1 - zoomLoc) * view.getWidth())
                                                    / view.pxPerBp));

        var eWidth = view.elem.clientWidth;
        var centerPx = view.bpToPx(fixedBp) - (zoomLoc * eWidth) + (eWidth / 2);
        // stripeWidth: pixels per block
        view.stripeWidth = view.stripeWidthForZoom(view.curZoom);
        view.scrollContainer.style.width =
            (view.stripeCount * view.stripeWidth) + "px";
        view.zoomContainer.style.width =
            (view.stripeCount * view.stripeWidth) + "px";
        var centerStripe = Math.round(centerPx / view.stripeWidth);
        var firstStripe = (centerStripe - ((view.stripeCount) / 2)) | 0;
        view.offset = firstStripe * view.stripeWidth;
        view.maxOffset = view.bpToPx(view.ref.end+1) - view.stripeCount * view.stripeWidth;
        view.maxLeft = view.bpToPx(view.ref.end+1) - view.getWidth();
        view.minLeft = view.bpToPx(view.ref.start);
        view.zoomContainer.style.left = "0px";
        view.setX((centerPx - view.offset) - (eWidth / 2));
        dojo.forEach(view.uiTracks, function(track) { track.clear(); });

        // needed, otherwise Density track can render wrong
        //    possibly would have problems with other Canvas-based tracks too, though haven't seen in XYPlot yet
        view.trackIterate( function(track) {
            track.endZoom( view.pxPerBp,Math.round(view.stripeWidth / view.pxPerBp));
        });

        view.showVisibleBlocks(true);
        view.showDone();
        view.showCoarse();
    },


    addStrandFilterOptions: function()  {
        var thisB = this;
        var browser = this.browser;

        var plus_strand_toggle = new dijitCheckedMenuItem(
                {
                    label: "Hide plus strand",
                    checked: (browser.cookie("plusStrandFilter")||"1")=="1",
                    onClick: function(event) {
                        browser.cookie("plusStrandFilter",this.get("checked")?"1":"0");
                        thisB.strandFilter("plusStrandFilter",thisB.plusStrandFilter);
                        browser.view.redrawTracks();
                    }
                });
        browser.addGlobalMenuItem( 'view', plus_strand_toggle );
        var minus_strand_toggle = new dijitCheckedMenuItem(
                {
                    label: "Hide minus strand",
                    checked: (browser.cookie("minusStandFilter")||"1")=="1",
                    onClick: function(event) {
                        browser.cookie("minusStrandFilter",this.get("checked")?"1":"0");
                        thisB.strandFilter("minusStrandFilter",thisB.minusStrandFilter);
                        browser.view.redrawTracks();
                    }
                });
        browser.addGlobalMenuItem( 'view', minus_strand_toggle );

        this.strandFilter("minusStrandFilter",this.minusStrandFilter);
        this.strandFilter("plusStrandFilter",this.plusStrandFilter);
    },
    strandFilter: function(name,callback) {
        var browser=this.browser;
        if(browser.cookie(name)=="1") {
            browser.addFeatureFilter(callback,name)
        } else {
            browser.removeFeatureFilter(name);
        }
    },
    minusStrandFilter: function(feature)  {
        var strand = feature.get('strand');
        if (strand == 1 || strand == '+')  { return true; }
        else  { return false; }
    },

    plusStrandFilter: function(feature)  {
        var strand = feature.get('strand');
        if (strand == -1 || strand == '-')  { return true; }
        else  { return false; }
    },
    
        
    addNavigationOptions: function()  {
        var thisB = this;
        var browser = this.browser;
        var select_Tracks = new dijitMenuItem(
            {
                label: "Sequences",
                onClick: function(event) {
                    window.open('../sequences', '_blank');
                }
            });
        browser.addGlobalMenuItem( 'view', select_Tracks );
        var recent_Changes = new dijitMenuItem(
            {
                label: "Changes",
                onClick: function(event) {
                    window.open('../changes', '_blank');
                }
            });
        browser.addGlobalMenuItem( 'view', recent_Changes );
        browser.addGlobalMenuItem( 'view', new dijitMenuSeparator());
    },

    initSearchMenu: function()  {
        if (! this.searchMenuInitialized) {
            var webapollo = this;
            this.browser.addGlobalMenuItem( 'tools',
                                            new dijitMenuItem(
                                                {
                                                    id: 'menubar_apollo_seqsearch',
                                                    label: "Search sequence",
                                                    onClick: function() {
                                                        webapollo.getAnnotTrack().searchSequence();
                                                    }
                                                }) );
            this.browser.renderGlobalMenu( 'tools', {text: 'Tools'}, this.browser.menuBar );

        }

        // move Tool menu in front of Help menu
        var toolsMenu = dijit.byId('dropdownbutton_tools');
        var helpMenu = dijit.byId('dropdownbutton_help');
        domConstruct.place(toolsMenu.domNode,helpMenu.domNode,'before');
        this.searchMenuInitialized = true;
    },


    initLoginMenu: function(username) {
        var webapollo = this;
        var loginButton;
        if (username)  {   // permission only set if permission request succeeded
            this.browser.addGlobalMenuItem( 'user',
                            new dijitMenuItem(
                                            {
                                                    label: 'Logout',
                                                    onClick: function()  {
                                                            webapollo.getAnnotTrack().logout();
                                                    }
                                            })
            );
            var userMenu = this.browser.makeGlobalMenu('user');
            loginButton = new dijitDropDownButton(
                            { className: 'user',
                                    innerHTML: '<span class="usericon"></span>' + username,
                                    title: 'user logged in: UserName',
                                    dropDown: userMenu
                            });
        }
        else  {
            loginButton = new dijitButton(
                            { className: 'login',
                                    innerHTML: "Login",
                                    onClick: function()  {
                                            webapollo.getAnnotTrack().login();
                                    }
                            });
        }
        this.browser.menuBar.appendChild( loginButton.domNode );
        this.loginMenuInitialized = true;
    },

    /**
     *  get the GenomeView's user annotation track
     *  WebApollo assumes there is only one AnnotTrack
     *     if there are multiple AnnotTracks, getAnnotTrack returns first one found
     *         iterating through tracks list
     */
    getAnnotTrack: function()  {
        if (this.browser && this.browser.view && this.browser.view.tracks)  {
            var tracks = this.browser.view.tracks;
            for (var i = 0; i < tracks.length; i++)  {
                // should be doing instanceof here, but class setup is not being cooperative
                if (tracks[i].isWebApolloAnnotTrack)  {
                    return tracks[i];
                }
            }
        }
        return null;
    },

    /**
     *  get the GenomeView's sequence track
     *  WebApollo assumes there is only one SequenceTrack
     *     if there are multiple SequenceTracks, getSequenceTrack returns first one found
     *         iterating through tracks list
     */
    getSequenceTrack: function()  {
        if (this.browser && this.browser.view && this.browser.view.tracks)  {
            var tracks = this.browser.view.tracks;
            for (var i = 0; i < tracks.length; i++)  {
                // should be doing instanceof here, but class setup is not being cooperative
                if (tracks[i].isWebApolloSequenceTrack)  {
                    return tracks[i];
                }
            }
        }
        return null;
    },


    /** ported from berkeleybop/jbrowse GenomeView.js
      * returns char height/width on GenomeView
      */
    getSequenceCharacterSize: function(recalc)  {
        var container = this.browser.container;
        if (this.browser.view && this.browser.view.elem)  {
            container = this.browser.view.elem;
        }
        if (recalc || (! this._charSize))  {
            //            this._charSize = this.calculateSequenceCharacterSize(this.browser.view.elem);
            this._charSize = this.calculateSequenceCharacterSize(container);
        }
        return this._charSize;
    },

    /**
     * ported from berkeleybop/jbrowse GenomeView.js
     * Conducts a test with DOM elements to measure sequence text width
     * and height.
     */
    calculateSequenceCharacterSize: function( containerElement ) {
        var widthTest = document.createElement("div");
        widthTest.className = "wa-sequence";
        widthTest.style.visibility = "hidden";
        var widthText = "12345678901234567890123456789012345678901234567890";
        widthTest.appendChild(document.createTextNode(widthText));
        containerElement.appendChild(widthTest);

        var result = {
            width:  widthTest.clientWidth / widthText.length,
            height: widthTest.clientHeight
        };

        containerElement.removeChild(widthTest);
        return result;
    },

    /** utility function, given an array with objects that have label props,
     *        return array with all objects that don't have label
     *   D = [ { label: A }, { label: B}, { label: C } ]
     *   E = D.removeItemWithLabel("B");
     *   E ==> [ { label: A }, { label: C } ]
     */
    removeItemWithLabel: function(inarray, label) {
        var outarray = [];
        for (var i=0; i<inarray.length; i++) {
            var obj = inarray[i];
            if (! (obj.label && (obj.label === label))) {
                outarray.push(obj);
            }
        }
        return outarray;
    },

    setFavicon: function(favurl) {
        var $head = $('head');
        // remove any existing favicons
        var $existing_favs = $("head > link[rel='icon'], head > link[rel='shortcut icon']");
        $existing_favs.remove();

        // add new favicon (as both rel='icon' and rel='shortcut icon' for better browser compatibility)
        var favicon1 = document.createElement('link');
        favicon1.id = "favicon_icon";
        favicon1.rel = 'icon';
        favicon1.type="image/x-icon";
        favicon1.href = favurl;

        var favicon2 = document.createElement('link');
        favicon2.id = "favicon_shortcut_icon";
        favicon2.rel = 'shortcut icon';
        favicon2.type="image/x-icon";
        favicon2.href = favurl;

        $head.prepend(favicon1);
        $head.prepend(favicon2);
    },
    monkeyPatchRegexPlugin: function() {
        //use var to avoid optimizer
        var plugin='RegexSequenceSearch/Store/SeqFeature/RegexSearch';
        require([plugin], function(RegexSearch) {
            lang.extend(RegexSearch,{
                translateSequence:function( sequence, frameOffset ) {
                    var slicedSeq = sequence.slice( frameOffset );
                    slicedSeq = slicedSeq.slice( 0, Math.floor( slicedSeq.length / 3 ) * 3);

                    var translated = "";
                    var codontable=new CodonTable();
                    var codons=codontable.generateCodonTable(codontable.defaultCodonTable);
                    for(var i = 0; i < slicedSeq.length; i += 3) {
                        var nextCodon = slicedSeq.slice(i, i + 3);
                        translated = translated + codons[nextCodon];
                    }

                    return translated;
                }
            });
        });
     }


});

});

});
