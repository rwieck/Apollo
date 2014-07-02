function copyOnly(mid) {
    return mid in {
        // There are no modules right now that are copy-only. If you have some, though, just add
        // them here like this:
        // 'app/module': 1
    };
}

var profile = {
    action: 'release',
    cssOptimize: 'comments',
    mini: true,

    basePath: '../../../src',
    packages: [
        {name: 'WebApollo', location: '../plugins/WebApollo/js' },
        {name: 'jquery', location: '../jslibs/jquery' }
        {name: 'jqueryui', location: '../jslibs/jqueryui' }
        {name: 'bbop', location: '../jslibs/bbop' }
    ]
};
