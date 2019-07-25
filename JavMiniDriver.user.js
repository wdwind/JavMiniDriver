// ==UserScript==
// @name         Jav小司机
// @namespace    wddd
// @version      1.1.1
// @author       wddd
// @license      MIT
// @include      http*://*javlibrary.com/*
// @description  Jav小司机。简单轻量速度快！
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @homepage     https://github.com/wdwind/JavMiniDriver
// @downloadURL  https://github.com/wdwind/JavMiniDriver/raw/master/JavMiniDriver.user.js
// ==/UserScript==

// Credit to
//  * https://greasyfork.org/zh-CN/scripts/25781
//  * https://greasyfork.org/zh-CN/scripts/37122

// Change log
// 1.1.1
/* 
 * Issue: https://github.com/wdwind/JavMiniDriver/issues/1
 * 
 * Change thumbnail font
 * Add page selector
 * Add japanese-bukkake as backup image screenshot source
 * Change image width to max-width when clicking the screenshot to prevent image being over zoomed
 * Add more data sources for the screenshots in reviews/comments
*/ 
// 1.1.0
/* 
 * Simplify code by merging the functions for get more comments/reviews
 * Process screenshots in reviews/comments
   * Remove redirection
   * Get full image url
   * Add mouse click effect
*/ 

// Utils

function setCookie(cookieName, cookieValue, expireDays) {
    let expireDate =new Date();
    expireDate.setDate(expireDate.getDate() + expireDays);
    let expires = "expires=" + ((expireDays == null) ? '' : expireDate.toUTCString());
    document.cookie = cookieName + "=" + cookieValue + ";" + expires + ";path=/";
}

function getCookie(cookieName) {
    let value = "; " + document.cookie;
    let parts = value.split("; " + cookieName + "=");
    if (parts.length == 2) {
        return parts.pop().split(";").shift();
    }
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function insertBefore(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode);
}

function removeElement(element) {
    return element.parentNode.removeChild(element);
}

function parseHTMLText(text) {
    try {
        let doc = document.implementation.createHTMLDocument('');
        doc.documentElement.innerHTML = text;
        return doc;
    } catch (e) {
        console.error('Parse error');
    }
}

// https://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro
function createElementFromHTML(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

function getLoadMoreButton(buttonId, callback) {
    let loadMoreButton = createElementFromHTML('<input type="button" class="largebutton" value="加载更多 &or;">');
    loadMoreButton.addEventListener('click', callback);

    buttonId = (buttonId != null) ? buttonId : 'load_more';
    let loadMoreDiv = createElementFromHTML(`<div id="${buttonId}" class="load_more"></div>`);
    loadMoreDiv.appendChild(loadMoreButton);
    return loadMoreDiv;
}

// For the requests in different domains
// GM_xmlhttpRequest is made from the background page, and as a result, it 
// doesn't have cookies in the request header
function gmFetch(obj) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: obj.method || 'GET',
            // timeout in ms
            timeout: obj.timeout,
            url: obj.url,
            headers: obj.headers,
            data: obj.data,
            onload: (result) => {
                if (result.status >= 200 && result.status < 300) {
                    resolve(result);
                } else {
                    reject(result);
                }
            },
            onerror: reject,
            ontimeout: reject,
        });
    });
}

// For the requests in the same domain
// XMLHttpRequest is made within the page, so it will send the cookies
function xhrFetch(obj) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(obj.method || 'GET', obj.url);
        // timeout in ms
        xhr.timeout = obj.timeout;
        if (obj.headers) {
            Object.keys(obj.headers).forEach(key => {
                xhr.setRequestHeader(key, obj.headers[key]);
            });
        }
        xhr.withCredentials = true;
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr);
            } else {
                reject(xhr);
            }
        };
        xhr.onerror = () => reject(xhr);
        xhr.ontimeout = () => reject(xhr);
        xhr.send(obj.data);
    });
};

// Style

function addStyle() {
    // social media
    GM_addStyle(`
        #toplogo {
            height: 55px;
        }
        .socialmedia {
            display: none !important;
            width: 0% !important;
            height: 0% !important;
        }
        .videothumblist .videos .video {
            height: 290px;
        }
        .thumbnailDetail {
            font-size: 14px;
            margin-top: 2.5em;
            color: #666666;
        }
        .page_selector {
            display: none;
            margin-bottom: 15px;
        }
        .load_more {
            text-align: center;
        }
        #load_next_page {
            margin-bottom: 10px;
        }
        #load_next_page_button {
            display: inline;
        }
        #togglePageSelector {
            margin-left: 20px;
            font-size: 14px;
            vertical-align: text-top;
            display: inline;
        }
        .toggle {
            cursor: pointer;
            color: blue;
        }
    `);

    // left menu
    if (window.location.href.includes('?v=')) {
        GM_addStyle(`
            #leftmenu {
                display: none;
                width: 0%;
            }
            #rightcolumn {
                margin-left: 10px;
            }
            /*
            #video_title .post-title:hover {
                text-decoration: underline;
                text-decoration-color: #CCCCCC;
            }
            */
            #video_id .text {
                color: red;
            }
            #torrents > table {
                width:100%;
                text-align: center;
                border: 2px solid grey;
            }
            #torrents tr td + td {
                border-left: 2px solid grey;
            }
            #video_favorite_edit {
                margin-bottom: 20px;
            }
            #torrents {
                margin-bottom: 20px;
            }
            #preview {
                margin-bottom: 20px;
            }
            #preview video {
                max-width: 100%;
            }
            .screenshot {
                cursor: pointer;
                max-width: 25%;
                display: block;
            }
            .clickToCopy {
                cursor: pointer;
            }
        `);
    }

    // Homepage
    if (!window.location.href.includes('.php')) {
        GM_addStyle(`
            .videothumblist {
                height: 645px !important;
            }
        `);
    }
}

// Thumbnail
class MiniDriverThumbnail {

    constructor() {
        this.loadMoreDivId = 'load_next_page';
        this.loadMoreButtonId = 'load_next_page_button';

        let showPageSelector = getCookie('showPageSelector') != 'block' ? 'none' : 'block';
        let pageSelector = document.getElementsByClassName('page_selector')[0];
        if (pageSelector) {
            pageSelector.style.display = showPageSelector;
        }

        let toggleMessage = getCookie('showPageSelector') != 'block' ? '显示页数' : '隐藏页数';
        this.togglePageSelector = createElementFromHTML(
            `<div id='togglePageSelector' class='toggle'>
                ${toggleMessage}
            </div>`);
        this.togglePageSelector.addEventListener('click', () => this.toggle());
    }

    execute() {
        this.updateVideoDetails(document);
        this.updateNextPage();
    }

    updateVideoDetails(doc) {
        let videos = doc.querySelectorAll('.videothumblist .videos .video');
        Array.from(videos).forEach(async video => {
            if (video.id.includes('vid_')) {
                let request = {url: `http://www.javlibrary.com/cn/?v=${video.id.substring(4)}`};
                let result = await xhrFetch(request).catch(err => {console.log(err); return;});
                let videoDetailsDoc = parseHTMLText(result.responseText);

                // Video date
                let videoDate = '';
                if (videoDetailsDoc.getElementById('video_date')) {
                    videoDate = videoDetailsDoc.getElementById('video_date').getElementsByClassName('text')[0].innerText;
                }

                // Video score
                let videoScore = '';
                if (videoDetailsDoc.getElementById('video_review')) {
                    let videoScoreStr = videoDetailsDoc.getElementById('video_review').getElementsByClassName('score')[0].innerText;
                    videoScore = videoScoreStr.substring(1, videoScoreStr.length - 1);
                }

                // Video watched
                let videoWatched = '0';
                if (videoDetailsDoc.getElementById('watched')) {
                    videoWatched = videoDetailsDoc.getElementById('watched').getElementsByTagName('a')[0].innerText;
                }
                
                let videoDetailsHtml = `
                    <div class="thumbnailDetail">
                        <span>${videoDate}</span>&nbsp;&nbsp;<span style='color:red;'>${videoScore}</span>
                        <br/>
                        <span>${videoWatched} 人看过</span>
                    </div>
                `;
                let videoDetails = createElementFromHTML(videoDetailsHtml);
                video.insertBefore(videoDetails, video.getElementsByClassName('toolbar')[0]);
            }
        });
    }

    async getNextPage(url) {
        // Fetch next page
        let result = await xhrFetch({url: url}).catch(err => {console.log(err); return;});
        let nextPageDoc = parseHTMLText(result.responseText);
        this.updateVideoDetails(nextPageDoc);

        // Update current page
        let videos = document.getElementsByClassName('videos');
        let nextPageVideos = nextPageDoc.getElementsByClassName('videos');
        if (nextPageVideos.length > 0) {
            Array.from(nextPageVideos[0].children).forEach(video => {
                videos[0].appendChild(video);
            });
        }

        // Remove existing load more button
        removeElement(document.getElementById(this.loadMoreButtonId));

        // Replace page selector content
        let pageSelector = document.getElementsByClassName('page_selector')[0];
        pageSelector.innerHTML = nextPageDoc.getElementsByClassName('page_selector')[0].innerHTML;
        
        // Add next page button
        let nextPage = nextPageDoc.getElementsByClassName('page next');
        if (nextPage.length > 0) {
            let nextPageUrl = nextPage[0].href;
            let loadMoreButton = getLoadMoreButton(this.loadMoreButtonId, async () => this.getNextPage(nextPageUrl));
            document.getElementById(this.loadMoreDivId).prepend(loadMoreButton);
        }
    }

    updateNextPage() {
        let loadMoreDiv = createElementFromHTML(`<div id='${this.loadMoreDivId}' class='load_more'></div>`);

        let nextPage = document.getElementsByClassName('page next');
        if (nextPage.length > 0) {
            let nextPageUrl = nextPage[0].href;
            let loadMoreButton = getLoadMoreButton(this.loadMoreButtonId, async () => this.getNextPage(nextPageUrl));
            loadMoreDiv.appendChild(loadMoreButton);
            loadMoreDiv.appendChild(this.togglePageSelector);
            document.getElementById('rightcolumn').appendChild(loadMoreDiv);
        }
    }

    toggle() {
        let pageSelector = document.getElementsByClassName('page_selector')[0];
        if (pageSelector.style.display === 'none') {
            pageSelector.style.display = 'block';
            this.togglePageSelector.innerText = '隐藏页数';
            setCookie('showPageSelector', 'block');
        } else {
            pageSelector.style.display = 'none';
            this.togglePageSelector.innerText = '显示页数';
            setCookie('showPageSelector', 'none');
        }
    }
}

class MiniDriver {

    constructor() {
        this.javUrl = new URL(window.location.href);
    }

    execute() {
        if (!this.javUrl.pathname.includes('.php')) {
            // Homepage or video page
            this.javVideoId = this.javUrl.searchParams.get('v');

            // Video page
            if (this.javVideoId != null) {
                this.setEditionNumber();
                this.updateTitle();
                this.addScreenshot();
                this.addTorrentLinks();
                this.updateReviews();
                this.updateComments();
                this.getPreview();
            }
        }
    }

    setEditionNumber() {
        let edition = document.getElementById('video_id').getElementsByClassName('text')[0];
        this.editionNumber = edition.innerText;
    }
    
    async updateTitle() {
        let videoTitle = document.getElementById('video_title');
        let postTitle = videoTitle.getElementsByClassName('post-title')[0];
        postTitle.innerText = postTitle.getElementsByTagName('a')[0].innerText;

        // Add English title 
        if (!window.location.href.includes('/en/')) {
            let request = {url: `http://www.javlibrary.com/en/?v=${this.javVideoId}`};
            let result = await xhrFetch(request).catch(err => {console.log(err); return;});
            let videoDetailsDoc = parseHTMLText(result.responseText);
            let englishTitle = videoDetailsDoc.getElementById('video_title')
                                    .getElementsByClassName('post-title')[0]
                                    .getElementsByTagName('a')[0].innerText;
            postTitle.innerHTML = `${postTitle.innerText}<br/>${englishTitle}`;
        }
    }

    screenShotOnclick(element) {
        if (element.style['max-width'] != '100%') {
            element.style['max-width'] = '100%';
        } else {
            element.style['max-width'] = '25%';
        }
    }

    async addScreenshot() {
        let javscreensUrl = `http://javscreens.com/images/${this.editionNumber}.jpg`;
        let videoDates = document.getElementById('video_date').getElementsByClassName('text')[0].innerText.split('-');
        let jbUrl = `http://img.japanese-bukkake.net/${videoDates[0]}/${videoDates[1]}/${this.editionNumber}_s.jpg`;

        for (let url of [javscreensUrl, jbUrl]) {
            let img = await this.loadImg(url).catch(() => {return;});
            if (img) {
                if (img.naturalHeight < 200) {
                    removeElement(img);
                    continue;
                }
                break;
            }
        }
    }

    loadImg(url) {
        console.log('Get screenshot '+ url);
        return new Promise((resolve, reject) => {
            let img = createElementFromHTML(`<img src="${url}" class="screenshot" title="">`);
            insertBefore(img, document.getElementById('rightcolumn').getElementsByClassName('socialmedia')[0]);
            img.addEventListener('click', () => this.screenShotOnclick(img));
            
            img.onload = () => resolve(img);
            img.onerror = reject;
        });
    }

    addTorrentLinks() {
        let sukebei = `https://sukebei.nyaa.si/?f=0&c=0_0&q=${this.editionNumber}`;
        let btsow = `https://btsow.pw/search/${this.editionNumber}`;
        let belibrary = `https://www.btlibrary.info/btlibrary/${this.editionNumber}/1-1-1-1.html`;
        let torrentKitty = `https://www.torrentkitty.tv/search/${this.editionNumber}`;
        let tokyotosho = `https://www.tokyotosho.info/search.php?terms=${this.editionNumber}`;
        
        let torrentsHTML = `
            <div id="torrents">
                <form id="form-btkitty" method="post" target="_blank" action="http://btkittyba.co/">
                    <input type="hidden" name="keyword" value="${this.editionNumber}">
                    <input type="hidden" name="hidden" value="true">
                </form>
                <form id="form-btdiggs" method="post" target="_blank" action="http://btdiggba.me/">
                    <input type="hidden" name="keyword" value="${this.editionNumber}">
                </form>
                <table>
                    <tr>
                        <td><strong>种子:</strong></td>
                        <td><a href="${sukebei}" target="_blank">sukebei</a></td>
                        <td><a href="${btsow}" target="_blank">btsow</a></td>
                        <td><a href="${belibrary}" target="_blank">belibrary</a></td>
                        <td><a href="${torrentKitty}" target="_blank">torrentKitty</a></td>
                        <td><a href="${tokyotosho}" target="_blank">tokyotosho</a></td>
                        <td><a id="btkitty" href="JavaScript:Void(0);" onclick="document.getElementById('form-btkitty').submit();">btkitty</a></td>
                        <td><a id="btdiggs" href="JavaScript:Void(0);" onclick="document.getElementById('form-btdiggs').submit();">btdiggs</a></td>
                    </tr>
                </table>
            </div>
        `;

        let torrents = createElementFromHTML(torrentsHTML);
        insertAfter(torrents, document.getElementById('video_favorite_edit'));
    }

    updateReviews() {
        // Remove existing reviews
        let videoReviews = document.getElementById('video_reviews');
        Array.from(videoReviews.children).forEach(child => {
            if (child.id.includes('review')) {
                child.parentNode.removeChild(child);
            }
        });

        // Add all reviews
        this.getNextPage(1, 'reviews');
    }

    async getNextPage(page, pageType) {
        let loadMoreId = 'load_more_' + pageType;
        let urlPath = 'video' + pageType;
        let elementsId = 'video_' + pageType;
        
        // Load more reviews
        let request = {url: `http://www.javlibrary.com/cn/${urlPath}.php?v=${this.javVideoId}&mode=2&page=${page}`};
        let result = await xhrFetch(request).catch(err => {console.log(err); return;});
        let doc = parseHTMLText(result.responseText);

        // Remove the load more div in current page
        let loadMoreDiv = document.getElementById(loadMoreId);
        if (loadMoreDiv != null) {
            loadMoreDiv.parentNode.removeChild(loadMoreDiv);
        }
        
        // Get comments/reviews in the next page
        let elements = doc.getElementById(elementsId);
        if (elements.getElementsByClassName('t').length == 0 || doc.getElementsByClassName('page_selector').length == 0) {
            return;
        }

        // Set element texts
        Array.from(elements.getElementsByClassName('t')).forEach(element => {
            let elementText = parseBBCode(escapeHtml(element.getElementsByTagName('textarea')[0].innerText));
            let elementHtml = createElementFromHTML(`<div>${parseHTMLText(elementText).body.innerHTML}</div>`);
            element.getElementsByClassName('text')[0].replaceWith(this.processScreenshot(elementHtml));
        });

        // Append elements to the page
        let currentElements = document.getElementById(elementsId);
        let bottomLine = currentElements.getElementsByClassName('grey')[0];
        Array.from(elements.children).forEach(element => {
            if (element.tagName == 'TABLE') {
                currentElements.insertBefore(element, bottomLine);
            }
        });

        // Append load more if next page exists
        let nextPage = doc.getElementsByClassName('page next');
        if (nextPage.length > 0) {
            let loadMoreButton = getLoadMoreButton(loadMoreId, async () => this.getNextPage(page + 1, pageType));
            insertAfter(loadMoreButton, currentElements);
        }
    }

    updateComments() {
        // Remove existing comments
        let videoComments = document.getElementById('video_comments');
        Array.from(videoComments.children).forEach(child => {
            if (child.id.includes('comment')) {
                child.parentNode.removeChild(child);
            }
        });

        // Add all comments
        this.getNextPage(1, 'comments');
    }

    processScreenshot(content) {
        let sources = [
            {regex: /imgspice/, process: (input) => input.replace(/_s|_t/, '')},
            {regex: /t[\d]+\.pixhost/, process: (input) => input.replace(/t([\d]+\.)/, 'img$1').replace('/thumbs/', '/images/')},
            {regex: /img[\d]+\.pixhost/, process: (input) => input},
            {regex: /imagetwist/, process: (input) => input.replace('/th/', '/i/')},
            {regex: /oloadcdn/, process: (input) => input},
            {regex: /subyshare/, process: (input) => input},
            {regex: /verystream/, process: (input) => input},
            {regex: /iceimg/, process: (input) => input.replace('/ssd/small/', '/uploads3/pixsense/big/').replace('/small-', '/')},
            {regex: /imgfrost/, process: (input) => input.replace('/small/small_', '/big/')},
            {regex: /japanese\-bukkake/, process: (input) => input},
            {regex: /picz\.in\.th/, process: (input) => input.replace('.md', '')},
            {regex: /photosex/, process: (input) => input},
            {regex: /imgtaxi/, process: (input) => input.replace('/small/', '/big/').replace('/small-medium/', '/big/')},
            {regex: /imgdrive/, process: (input) => input.replace('/small/', '/big/').replace('/small-medium/', '/big/')},
            {regex: /sehuatuchuang/, process: (input) => input},
            {regex: /900file/, process: (input) => input},
            {regex: /avcensdownload/, process: (input) => input},
            {regex: /filesor/, process: (input) => input.replace('_s', '')},
        ];

        // Get full img url
        Array.from(content.getElementsByTagName('img')).forEach(img => {
            if (img.src != null) {
                for (let source of sources) {
                    if (img.src.match(source.regex)) {
                        let imgUrl = source.process(img.src);
                        let screenshot = createElementFromHTML(`<img class="screenshot processed" referrerpolicy="no-referrer" src="${imgUrl}">`);
                        screenshot.addEventListener('click', () => this.screenShotOnclick(screenshot));
                        img.replaceWith(screenshot);
                        break;
                    }
                }
            }
        });
        
        // Remove the redirection
        Array.from(content.getElementsByTagName('a')).forEach(element => {
            let imgs = element.getElementsByTagName('img');
            if (imgs.length == 1 && imgs[0].className.includes('processed')) {
                element.replaceWith(imgs[0]);
            }
        });

        return content;
    }

    getPreview() {
        let includesEditionNumber = (str) => {
            return str != null
                    // && str.includes(this.editionNumber.toLowerCase().split('-')[0])
                    && str.includes(this.editionNumber.toLowerCase().split('-')[1]);
        }

        let r18 = async () => {
            let request = {url: `https://www.r18.com/common/search/order=match/searchword='${this.editionNumber}'/`};
            let result = await gmFetch(request).catch(err => {console.log(err); return;});
            let video_tag = parseHTMLText(result.responseText).querySelector('.js-view-sample');
            let src = ['high', 'med', 'low']
                            .map(i => video_tag.getAttribute('data-video-' + i))
                            .find(i => i);
            return src;
        }

        let dmm = async () => {
            // Find dmm cid
            let bingRequest = {url: `https://www.bing.com/search?q=${this.editionNumber.toLowerCase()}+site%3awww.dmm.co.jp`}
            let bingResult = await gmFetch(bingRequest).catch(err => {console.log(err); return;});
            let bingDoc = parseHTMLText(bingResult.responseText);
            let pattern = /(cid=[\w]+|pid=[\w]+)/g;
            let dmmCid = '';
            for (let match of bingDoc.body.innerHTML.match(pattern)) {
                if (includesEditionNumber(match)) {
                    dmmCid = match.replace(/(cid=|pid=)/, '');
                    break;
                }
            }

            if (dmmCid == '') {
                return;
            }

            let request = {url: `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${dmmCid}/mtype=AhRVShI_/service=litevideo/mode=/width=560/height=360/`};
            let result = await gmFetch(request).catch(err => {console.log(err); return;});
            let doc = parseHTMLText(result.responseText);

            // Very hacky... Didn't find a way to parse the HTML with JS.
            for (let script of doc.getElementsByTagName('script')) {
                if (script.innerText != null && script.innerText.includes('.mp4')) {
                    for (let line of script.innerText.split('\n')) {
                        if (line.includes('var params')) {
                            line = line.replace('var params =', '').replace(';', '');
                            let videoSrc = JSON.parse(line).src;
                            if (!videoSrc.startsWith('http')) {
                                videoSrc = 'http:' + videoSrc;
                            }
                            return videoSrc;
                        }
                    }
                }
            }
        }

        let sod = async () => {
            // Adult check
            await gmFetch({url: `https://ec.sod.co.jp/prime/_ontime.php`});

            let request = {url: `https://ec.sod.co.jp/prime/videos/sample.php?id=${this.editionNumber}`};
            let result = await gmFetch(request).catch(err => {console.log(err); return;});
            let doc = parseHTMLText(result.responseText);
            return doc.getElementsByTagName('source')[0].src;
        }

        let jav321 = async () => {
            let request = {
                url: `https://www.jav321.com/search`,
                method: 'POST',
                data: `sn=${this.editionNumber}`,
                headers: {
                    referer: 'https://www.jav321.com/',
                    'content-type': 'application/x-www-form-urlencoded',
                },
            };

            let result = await gmFetch(request).catch(err => {console.log(err); return;});
            let doc = parseHTMLText(result.responseText);
            return doc.getElementsByTagName('source')[0].src;
        }

        let kv = async () => {
            if (this.editionNumber.includes('KV-')) {
                return `http://fskvsample.knights-visual.com/samplemov/${this.editionNumber.toLowerCase()}-samp-st.mp4`;
            }

            return;
        }

        Promise.all(
            [jav321, r18, dmm, sod, kv].map(source => source().catch(err => {console.log(err); return;}))
        ).then(responses => {
            console.log(responses);

            let videoHtml = responses
                                .filter(response => response != null 
                                        && includesEditionNumber(response) 
                                        && !response.includes('//_sample.mp4'))
                                .map(response => `<source src="${response}">`)
                                .join('');
            if (videoHtml != '') {
                let previewHtml = `
                    <div id="preview">
                        <video controls>
                            ${videoHtml}
                        </video>
                    </div>
                `;
                insertAfter(createElementFromHTML(previewHtml), document.getElementById('torrents'));
            }
        });
    }
}

// Adult check
setCookie('over18', 18);

// Style change
addStyle();

new MiniDriver().execute();
new MiniDriverThumbnail().execute();
