function onError(error) {
  console.log(`[Must Include] Error: ${error}`);
}
var ever_run = false;
var toggle_allintext = false;
var pendingToggle = false;
function onQueryStorage(item) {
	if (item.toggle_allintext) {
		toggle_allintext = item.toggle_allintext;
	}
	setIcon();
}
function setIcon() {
	chrome.browserAction.setIcon({
		path: {
		'60': toggle_allintext ? 'icons/enabled_must_60x60.png' : 'icons/disabled_must_60x60.png'
		}
		});
	chrome.browserAction.setTitle({
		title: toggle_allintext ? 'Google Must Include is enabled.' : 'Google Must Include is disabled.'
	});
}
function onQueryFirstTime(item) {
	if (item.ever_run === true) { //get latest user config
		//console.log('first time');
		//let getting = chrome.storage.local.get( {"toggle_allintext" : false} );
		chrome.storage.local.get( {"toggle_allintext" : false}, onQueryStorage);
		//getting.then(onQueryStorage, onError);
	} else { //set toggle turn on because first time install
		//console.log('not first time');
		toggle_allintext = true;
		chrome.storage.local.set({
			toggle_allintext: toggle_allintext
		});
		chrome.storage.local.set({
			ever_run: true
		});
		setIcon();
	}
}

chrome.storage.local.get( {"ever_run" : false}, onQueryFirstTime );
//ever_run.then(onQueryFirstTime, onError);

chrome.browserAction.onClicked.addListener(({id}) => {
	toggle_allintext = !toggle_allintext
	chrome.storage.local.set({
		toggle_allintext: toggle_allintext
	});
	setIcon();
})


var reqIds = [];
chrome.webRequest.onBeforeRequest.addListener(
        function(details) {
		//console.log("parsing 0", details);
		//console.log("getting 0: ", toggle_allintext);
		reqId = details.requestId;
		if ( !toggle_allintext || reqIds.indexOf(reqId) > -1) { //to prevent infinite loop, lolr
			reqIds = reqIds.filter(reqI => reqI !== reqId); //remove after check
			//no nid worry http to https load twice, this still better than growth the array forever without delete if not restart Firefox
		} else {
			reqIds.push(reqId);

			//console.log("parsing 1: ", details.url );
                        var url = details.url;

                        var base = url.substring(0, url.indexOf("?"));
                        var q = url.substring(url.indexOf("?") + 1);
			var gp = '';
			var other_p = '';
			if (q.startsWith('q=')) {
				gp =  q.split('q=')[1].split('&')[0];
			}

			all_p = q.split('&');
			for (var ai = 0; ai < all_p.length; ai++) {
				if (!(all_p[ai].startsWith('q='))) {
					if (other_p.length > 0) other_p = other_p + '&'  + all_p[ai];
					else other_p = '&' + all_p[ai];
				}
			}
			
			var params = q.split('&q=');
			for (var i = 0; i < params.length; i++) {
				if (i > 0) {
					gp+= ' ' + params[i].split('&')[0]					
				}
			}
			gp = gp.trim();
		
			/* original idea (but got some change to prevent duplicated allintext):
			[1] split by space, loop:
			[2] if contains('%3A'/':'), trim quotes if any -> move token to list A(final_q)
			[3] else prefix allintext: and move all to list B(intext_q)
			[4] done loop, concat A and B with space
			*/
			var qpl = gp.split('+');
			var nextColonVar = false;
			var final_q = '';
			var intext_q = '';
			var intext_once = false;
			for (var i = 0; i < qpl.length; i++) {
				var new_q = qpl[i];
                                if (new_q.indexOf(":") > -1) { //filetype%3Apdf, result's bottom next page index become ":", so handle such case
                                    new_q = new_q.replace(/:/g, "%3A");
                                }
				if (new_q.indexOf("%3A") > -1) {
					new_q = new_q.replace(/"/g,"").trim();
					if (new_q.startsWith('allintext%3A')) {
						new_q = new_q.substring(12).trim();
						if (intext_once) {
							intext_q+= '+' + new_q;
						} else {
							intext_q+=new_q;
						}
						intext_once = true;
					} else {
						if (new_q.endsWith('%3A')) {
							nextColonVar = true;
							final_q+=new_q;
						} else {
							if (final_q.length === 0) {
								final_q+=new_q;
							} else {
								final_q+= '+' + new_q;
							}
						}
					}
				} else {
					if (nextColonVar) {
						new_q = new_q.replace(/"/g,"").trim();
						final_q+=new_q;
					} else {
						if (intext_once) {
							intext_q+= '+' + new_q; //don't replace quotes since it got meaning of word exact match
						}
						else {
							intext_q+= new_q;
						}
						intext_once = true;
					}
				}
				nextColonVar = false;
			}
			if (intext_once) {
				//console.log('intext_q:: ' +  intext_q);
				//console.log('final_q:: ' + final_q);
			
				var q23 = '';
				var q22 = intext_q.split('%22');
				var start_q = false; //start quotes
				let added_once = false;
 				for (var qi = 0; qi < q22.length; qi++) {
					if (start_q) {
						start_q = false;
						let qq = q22[qi];
						//console.log('[start_q] qq: ' + qq);
						if (qq.indexOf('+') > -1 ) {
							while (qq.startsWith('+')) {
								qq = qq.substring(1);
							}
							while (qq.endsWith('+')) {
								qq = qq.substring(0, qq.length - 1);
							}
	
						}
						if ( qq.trim().replace(/%22|%27|\+/g, '').length > 0 ) {
							//add only if not all single/double quotes/+
							if (qq.startsWith('-')) {
								//console.log('[qq -] : ' + qq);
								qq = '%22' + qq.substring(1) + '%22';
								if ( qq.trim().replace(/%22|%27|\+/g, '').length > 0 ) {
									//console.log('[qq -2] : ' + qq);
									q23 = q23 + '+-' + qq;
									added_once = true;
									//console.log('added A q23: ' + q23);
								}
							} else { //test: "web" -"free"
								if ( (q23.length !== 0)  && !q23.endsWith('-') ) q23+='+';
								q23 = q23 + '%22' + qq + '%22';
								added_once = true;
								//console.log('added B q23: ' + q23);
							}
						}
					} else {
						start_q = true;
						let qq = q22[qi];
						//console.log('[NORMLA] qq: ' + qq);
						if (qq.length > 0 && qq !== '+') {
							if (qq.indexOf('+') > -1 ) {
								//console.log('[NORMAL qq +] Before: ' + qq);
								while (qq.startsWith('+')) {
									qq = qq.substring(1);
								}
								while (qq.endsWith('+')) {
									qq = qq.substring(0, qq.length - 1);
								}
								
								while (qq.indexOf('++') > -1) { //remove duplicated +
									qq = qq.replace(/\+\+/g, '+');
								} 	
								//test cast: prevent a -"a" (Or a+- here) to "a" -"" "a" (Or a%22+-%22 below)
								let pending_negate = false;
								if (qq.endsWith('+-')) {
									pending_negate = true;
									qq = qq.substring(0, qq.length - 1); //tail +- to + then add back later
								}
								//	qq = qq.replace(/\+\-/g, '-');
								//}
								//a    -b

								qq = qq.replace(/\+/g, '%22+%22');
								if (pending_negate) {
									qq = qq + '-';
									//qq = qq.replace(/%22\-/g, '-%22');
								}
								//if (added_once) {
								//	if (!qq.startsWith('+')) qq = '+' + qq;
								//}
								//console.log('qq middle: ' + qq);
								//if (qq.endsWith('-') && !qq.endsWith('+-')) {
								//	//test case: insert '+' space, to prevent a -"a" to "a-" "a"
								//	qq = qq.substring(0, qq.length -1) + '+-';
								//}
								//console.log('[NORMAL qq +] After: ' + qq);
							}
							if ( qq.trim().replace(/%22|%27|\+|\-/g, '').length > 0 ) {
								//if (qq.startsWith('-')) {
								/*	console.log('[NORMAL qq -] : ' + qq);
									if (added_once) {
										if (!q23.endsWith('+')) q23 = q23 + '+';
									}
									q23 = q23 + qq;
									added_once = true;
									console.log('[NORMAL] added C q23: ' + q23);
								*/
								//add only if not all single/double quotes/+
								
								//console.log('q23 bottom 0.0 q23 : ' + q23 + ' qq: ' + qq);
								if ( (q23.length !== 0)  && !q23.endsWith('-') ) q23+='+';
								//console.log('q23 bottom 0 q23 : ' + q23);
								while (qq.startsWith('+')) qq = qq.substring(1); //prevent "ab" c become "ab" "<space>c"
								//console.log('q23 bottom 1 q23 : ' + q23);
								if (added_once) {
									if (!q23.endsWith('+')) q23 = q23 + '+';
									//console.log('q23 bottom 2 q23 : ' + q23);
								}
								if (qq.startsWith('-')) { //test case: "a" "-b"
									//console.log('q23 bottom 3 q23 : ' + q23);
									qq = qq.substring(1);
									q23+='-';
								}
								//console.log('q23 bottom 3 qq : ' + qq);
								if (qq.endsWith('-')) { //test case: prevent a -"a"(a-)  to "a -" "a"(%22a+-%22)
									//console.log('q23 bottom 4 q23 : ' + q23);
									qq = qq.substring(0, qq.length -1);
									let pre = '';
									let post = '';
									if (!qq.startsWith('%22')) pre = '%22';
									if (!qq.endsWith('%22')) post = '%22';
									q23 = q23 + pre + qq + post + '+-'; //negate move to back
								} else {
									//console.log('q23 bottom 5 q23 : ' + q23);
									qq = qq.replace(/%22\-/g, '-%22'); //test case a -b, a -b -c
									if (!qq.startsWith('%22')) pre = '%22';
									if (!qq.endsWith('%22')) post = '%22';
									q23 = q23 + pre + qq + post;
								}
								//console.log('q23 bottom 5.5: ' + q23);
								q23 = q23.replace(/%22\+%22\+/g, '%22+'); //test case: "a" -"a" a - "a" 
								//console.log('q23 bottom 5.6: ' + q23);
								q23 = q23.replace(/%22\+%22\-/g, '%22+-'); //test case: a -b
								//console.log('q23 bottom 6 q23 : ' + q23 + ' qq: ' + qq);
								added_once = true;
								//console.log('[NORMAL] added q23 D: ' + q23);
							} else if ( qq.indexOf('-') > -1 ) {
								q23 = q23 + '+-';
								added_once = true;
							}  //else { console.log('nothing: ' + qq + ' i:' + qq.indexOf('-'));  } //test case: ' OR "
						}
					}
				}

				//test case: -a , -a -b
				q23 = q23.trim();
				if (q23.length > 0) { //to prevent search by image add single quotes only
					if (!q23.startsWith('%22')) {
						while (q23.startsWith('+')) { //prevent single "-a" to " -"a"
							q23 = q23.substring(1);
						}
						if (q23.startsWith('-')) {
							let check_negate = q23;
							while (check_negate.startsWith('-')) {
								check_negate = check_negate.substring(1);
							}
							if (!check_negate.startsWith('%22')) {
								q23 = '-%22' + check_negate;
							}
						} else {
							q23 = '%22' + q23;
						}
					}
					if (!q23.endsWith('%22')) {
						q23+='%22';
					}
				}

				if (final_q.length === 0) {
					//final_q = 'allintext%3A' +  intext_q; //allintext sometime no result at all
					final_q = q23;
				} else {
					//final_q+= '+allintext%3A' +  intext_q;
					final_q+= '+' + q23;
				}
				//console.log('final_q::: ' + final_q);
			}
			final_q = final_q.trim();
                        //console.log("redirect url: " + base + '?q=' + final_q);
			return {redirectUrl: base + '?q=' + final_q + other_p };
                }
        },
	{urls: [
		"*://*.google.com/search?*",
		"*://*.google.ac/search?*",
		"*://*.google.ad/search?*",
		"*://*.google.ae/search?*",
		"*://*.google.com.af/search?*",
		"*://*.google.com.ag/search?*",
		"*://*.google.com.ai/search?*",
		"*://*.google.al/search?*",
		"*://*.google.am/search?*",
		"*://*.google.co.ao/search?*",
		"*://*.google.com.ar/search?*",
		"*://*.google.as/search?*",
		"*://*.google.at/search?*",
		"*://*.google.com.au/search?*",
		"*://*.google.az/search?*",
		"*://*.google.ba/search?*",
		"*://*.google.com.bd/search?*",
		"*://*.google.be/search?*",
		"*://*.google.bf/search?*",
		"*://*.google.bg/search?*",
		"*://*.google.com.bh/search?*",
		"*://*.google.bi/search?*",
		"*://*.google.bj/search?*",
		"*://*.google.com.bn/search?*",
		"*://*.google.com.bo/search?*",
		"*://*.google.com.br/search?*",
		"*://*.google.bs/search?*",
		"*://*.google.bt/search?*",
		"*://*.google.co.bw/search?*",
		"*://*.google.by/search?*",
		"*://*.google.com.bz/search?*",
		"*://*.google.ca/search?*",
		"*://*.google.com.kh/search?*",
		"*://*.google.cc/search?*",
		"*://*.google.cd/search?*",
		"*://*.google.cf/search?*",
		"*://*.google.cat/search?*",
		"*://*.google.cg/search?*",
		"*://*.google.ch/search?*",
		"*://*.google.ci/search?*",
		"*://*.google.co.ck/search?*",
		"*://*.google.cl/search?*",
		"*://*.google.cm/search?*",
		"*://*.google.cn/search?*",
		"*://*.google.com.co/search?*",
		"*://*.google.co.cr/search?*",
		"*://*.google.com.cu/search?*",
		"*://*.google.cv/search?*",
		"*://*.google.com.cy/search?*",
		"*://*.google.cz/search?*",
		"*://*.google.de/search?*",
		"*://*.google.dj/search?*",
		"*://*.google.dk/search?*",
		"*://*.google.dm/search?*",
		"*://*.google.com.do/search?*",
		"*://*.google.dz/search?*",
		"*://*.google.com.ec/search?*",
		"*://*.google.ee/search?*",
		"*://*.google.com.eg/search?*",
		"*://*.google.es/search?*",
		"*://*.google.com.et/search?*",
		"*://*.google.fi/search?*",
		"*://*.google.com.fj/search?*",
		"*://*.google.fm/search?*",
		"*://*.google.fr/search?*",
		"*://*.google.ga/search?*",
		"*://*.google.ge/search?*",
		"*://*.google.gf/search?*",
		"*://*.google.gg/search?*",
		"*://*.google.com.gh/search?*",
		"*://*.google.com.gi/search?*",
		"*://*.google.gl/search?*",
		"*://*.google.gm/search?*",
		"*://*.google.gp/search?*",
		"*://*.google.gr/search?*",
		"*://*.google.com.gt/search?*",
		"*://*.google.gy/search?*",
		"*://*.google.com.hk/search?*",
		"*://*.google.hn/search?*",
		"*://*.google.hr/search?*",
		"*://*.google.ht/search?*",
		"*://*.google.hu/search?*",
		"*://*.google.co.id/search?*",
		"*://*.google.iq/search?*",
		"*://*.google.ie/search?*",
		"*://*.google.co.il/search?*",
		"*://*.google.im/search?*",
		"*://*.google.co.in/search?*",
		"*://*.google.io/search?*",
		"*://*.google.is/search?*",
		"*://*.google.it/search?*",
		"*://*.google.je/search?*",
		"*://*.google.com.jm/search?*",
		"*://*.google.jo/search?*",
		"*://*.google.co.jp/search?*",
		"*://*.google.co.ke/search?*",
		"*://*.google.ki/search?*",
		"*://*.google.kg/search?*",
		"*://*.google.co.kr/search?*",
		"*://*.google.com.kw/search?*",
		"*://*.google.kz/search?*",
		"*://*.google.la/search?*",
		"*://*.google.com.lb/search?*",
		"*://*.google.com.lc/search?*",
		"*://*.google.li/search?*",
		"*://*.google.lk/search?*",
		"*://*.google.co.ls/search?*",
		"*://*.google.lt/search?*",
		"*://*.google.lu/search?*",
		"*://*.google.lv/search?*",
		"*://*.google.com.ly/search?*",
		"*://*.google.co.ma/search?*",
		"*://*.google.md/search?*",
		"*://*.google.me/search?*",
		"*://*.google.mg/search?*",
		"*://*.google.mk/search?*",
		"*://*.google.ml/search?*",
		"*://*.google.com.mm/search?*",
		"*://*.google.mn/search?*",
		"*://*.google.ms/search?*",
		"*://*.google.com.mt/search?*",
		"*://*.google.mu/search?*",
		"*://*.google.mv/search?*",
		"*://*.google.mw/search?*",
		"*://*.google.com.mx/search?*",
		"*://*.google.com.my/search?*",
		"*://*.google.co.mz/search?*",
		"*://*.google.com.na/search?*",
		"*://*.google.ne/search?*",
		"*://*.google.com.nf/search?*",
		"*://*.google.com.ng/search?*",
		"*://*.google.com.ni/search?*",
		"*://*.google.nl/search?*",
		"*://*.google.no/search?*",
		"*://*.google.com.np/search?*",
		"*://*.google.nr/search?*",
		"*://*.google.nu/search?*",
		"*://*.google.co.nz/search?*",
		"*://*.google.com.om/search?*",
		"*://*.google.com.pk/search?*",
		"*://*.google.com.pa/search?*",
		"*://*.google.com.pe/search?*",
		"*://*.google.com.ph/search?*",
		"*://*.google.pl/search?*",
		"*://*.google.com.pg/search?*",
		"*://*.google.pn/search?*",
		"*://*.google.com.pr/search?*",
		"*://*.google.ps/search?*",
		"*://*.google.pt/search?*",
		"*://*.google.com.py/search?*",
		"*://*.google.com.qa/search?*",
		"*://*.google.ro/search?*",
		"*://*.google.rs/search?*",
		"*://*.google.ru/search?*",
		"*://*.google.rw/search?*",
		"*://*.google.com.sa/search?*",
		"*://*.google.com.sb/search?*",
		"*://*.google.sc/search?*",
		"*://*.google.se/search?*",
		"*://*.google.com.sg/search?*",
		"*://*.google.sh/search?*",
		"*://*.google.si/search?*",
		"*://*.google.sk/search?*",
		"*://*.google.com.sl/search?*",
		"*://*.google.sn/search?*",
		"*://*.google.sm/search?*",
		"*://*.google.so/search?*",
		"*://*.google.st/search?*",
		"*://*.google.sr/search?*",
		"*://*.google.com.sv/search?*",
		"*://*.google.td/search?*",
		"*://*.google.tg/search?*",
		"*://*.google.co.th/search?*",
		"*://*.google.com.tj/search?*",
		"*://*.google.tk/search?*",
		"*://*.google.tl/search?*",
		"*://*.google.tm/search?*",
		"*://*.google.to/search?*",
		"*://*.google.tn/search?*",
		"*://*.google.com.tr/search?*",
		"*://*.google.tt/search?*",
		"*://*.google.com.tw/search?*",
		"*://*.google.co.tz/search?*",
		"*://*.google.com.ua/search?*",
		"*://*.google.co.ug/search?*",
		"*://*.google.co.uk/search?*",
		"*://*.google.com.uy/search?*",
		"*://*.google.co.uz/search?*",
		"*://*.google.com.vc/search?*",
		"*://*.google.co.ve/search?*",
		"*://*.google.vg/search?*",
		"*://*.google.co.vi/search?*",
		"*://*.google.com.vn/search?*",
		"*://*.google.vu/search?*",
		"*://*.google.ws/search?*",
		"*://*.google.co.za/search?*",
		"*://*.google.co.zm/search?*",
		"*://*.google.co.zw/search?*" 
	]},
        ["blocking"]);

chrome.contextMenus.create({
  id: "google-with-double-quotes",
  title: "Google with single double quotes",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  switch (info.menuItemId) {
	case "google-with-double-quotes": {
		let t = info.selectionText.replace(/"/g, ''); //To support select to clear all quotes and re-google
		chrome.tabs.create({ //actually normal text is %20 will quotes if use this extension already so may no need %22 below, but still to ensures always quotes regardless of colon, better force it by quotes explicitly
			url: "https://www.google.com/search?client=firefox-b-d&q=%22" + encodeURIComponent(t) + "%22"
		});
		break;
	}
  }
});






