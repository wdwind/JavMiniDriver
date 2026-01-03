// ==UserScript==
// @name         Jav小司机
// @namespace    wddd
// @version      1.1.5
// @author       wddd
// @license      MIT
// @include      http*://*javlibrary.com/*
// @include      http*://*javlib.com/*
// @include      http*://*m34z.com/*
// @include      http*://*j41g.com/*
// @include      http*://*h28o.com/*
// @description  Jav小司机。简单轻量速度快！
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @homepage     https://github.com/wdwind/JavMiniDriver
// @downloadURL  https://github.com/wdwind/JavMiniDriver/raw/master/JavMiniDriver.user.js
// ==/UserScript==

// Credit to
//  * https://greasyfork.org/zh-CN/scripts/25781
//  * https://greasyfork.org/zh-CN/scripts/37122

// Change log
// 1.1.5
/** 
 * Add page selector in video detail page
 * Support filters by score and viewers
*/
// 1.1.4
/** 
 * Add support for j41g.com and h28o.com
 * Block ad
 * Only load the full screenshot until user clicks the thumbnail
*/
// 1.1.3
/** 
 * Issue: https://github.com/wdwind/JavMiniDriver/issues/1#issuecomment-521836751
 *
 * Update browser history when clicking "load more" button in video list page
 * Store the configuration of whether to show the page selector in local storage instead of cookies
 * Fix a screenshot bug to handle non-existing images gracefully
 * Temporarily remove video from sod.co.jp since it requires a Referer in http request header
 * ~~Add a iframe to bypass adult check and DDoS check of sod.co.jp~~
 * Other technical refactoring
*/
// 1.1.2
/** 
 * Issue: https://greasyfork.org/zh-CN/forum/discussion/61213/x
 *
 * Minor updates
 * Add javbus torrent search
 * Add support for javlib.com and m34z.com
*/
// 1.1.1
/** 
 * Issue: https://github.com/wdwind/JavMiniDriver/issues/1
 *
 * Change thumbnail font
 * Add page selector
 * Add japanese-bukkake as backup image screenshot source
 * Change image width to max-width when clicking the screenshot to prevent image being over zoomed
 * Add more data sources for the screenshots in reviews/comments
*/
// 1.1.0
/** 
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

// Not used
// function getCookie(cookieName) {
//     let value = "; " + document.cookie;
//     let parts = value.split("; " + cookieName + "=");
//     if (parts.length == 2) {
//         return parts.pop().split(";").shift();
//     }
// }

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function insertBefore(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode);
}

function removeElementIfPresent(element) {
    if (element) {
        return element.parentNode.removeChild(element);
    }
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
            headers: obj.headers ? obj.headers : {},
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
    return fetch(obj.url, {
        method: obj.method || 'GET',
        headers: obj.headers || {},
        body: obj.data,
        credentials: 'include',
        timeout: obj.timeout,
    });
}

function xhrFetchWithRetry(obj) {
    let fun = (obj) => xhrFetch(obj).then(response => {
        if (response.status == 429) {
            throw new Error('429 (Too Many Requests)');
        } else {
            return response;
        }
    });

    return retry(fun, obj);
}

async function retry(fun, input, max_retries = 10, retries = 0, initial = 8000) {
    try {
		return await fun(input);
	} catch (e) {
		if (retries > max_retries) {
			throw e;
		}

        GM_log(`Retrying ${retries}, wait ${initial + (2 ** retries) * 1000} ms`);

        // wait
		await new Promise(_ => setTimeout(_, initial + (2 ** retries) * 1000));

        // retry
		return retry(fun, input, max_retries, retries + 1, initial);
	}
}

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
            display: block;
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
        .bottombanner2 {
            display: none !important;
        }
        table.displaymode {
            table-layout: fixed;
        }
        td.mid {
            text-align: left;
            font: bold 12px monospace;
        }
        input.slider {
            direction: rtl;
            height: 10px;
            margin-left: 10px;
        }
        .filter {
            display: inline-block;
        }
        .filterMinValue {
            display: inline-block;
        }
    `);

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
        this.filterKeys = ['minScore', 'minViewer'];
        this.filterConfigs = {'minScore': {'value' : GM_getValue('minScore', 0), 'max': 10},
                                'minViewer': {'value' : GM_getValue('minViewer', 0), 'max': 100}};
        this.videoStats = {};
    }

    execute() {
        let videos = document.getElementsByClassName('videos')[0];
        document.getElementsByClassName('videothumblist')[0].innerHTML = `<div class="videothumblist">
                                                                            <div class="videos"></div>
                                                                        </div>`;
        let pageSelector = document.getElementsByClassName('page_selector')[0];
        this.updatePageContent(videos, pageSelector);
        this.addFilters();
    }

    addFilters() {
        let filters = createElementFromHTML(
            `<td class="mid">
                <div class="filter">
                    显示 <label for="score">评分 &gt; </label>
                    <div class="filterMinValue">0</div>
                    <!--<input type="number" id="minScore" min="0">-->
                    <input type="range" id="minScore" min="0" class="slider">
                </div>
                <div class="filter">
                    <label for="viewers">观看人数 &gt; </label>
                    <div class="filterMinValue">0</div>
                    <!--<input type="number" id="minViewer" min="0">-->
                    <input type="range" id="minViewer" min="0" class="slider">
                </div>
            </td>`);
        
        
        let sliders = filters.getElementsByClassName('slider');
        let valueDiv = filters.getElementsByClassName('filterMinValue');

        function round(num) {
            return Math.round(num * 100) / 100;
        }
        function getSliderValue(input, max) {
            return round(100 - input * (100 / max));
        }
        function getConfigValue(input, max) {
            return round(max - input / (100 / max));
        }

        for (let i = 0; i < sliders.length; i++) {
            let config = this.filterConfigs[this.filterKeys[i]];

            sliders[i].value = getSliderValue(config['value'], config['max']);
            valueDiv[i].innerText = config['value'];

            sliders[i].addEventListener('change', () => {
                let updatedConfig = getConfigValue(sliders[i].value, config['max']);
                valueDiv[i].innerText = updatedConfig;
                GM_setValue(this.filterKeys[i], updatedConfig);

                this.applyFilters();
            });
        }

        // Insert filter to the page
        let mode = document.getElementsByClassName('displaymode');
        if (mode.length > 0) {
            let leftMode = mode[0].getElementsByClassName('left');
            if (leftMode.length > 0) {
                insertAfter(filters, leftMode[0]);
            }
        }
    }

    applyFilters() {
        for (let key in this.videoStats) {
            this.applyFilterOn(key);
        }
    }

    applyFilterOn(videoKey) {
        let video = document.getElementById(videoKey);
        if (video) {
            let show = true;
            
            for (let filter of this.filterKeys) {
                let config = GM_getValue(filter, 0);

                if (config > 0) {
                    if (!(filter in this.videoStats[videoKey]) 
                            || !this.videoStats[videoKey][filter] 
                            || this.videoStats[videoKey][filter] == NaN 
                            || this.videoStats[videoKey][filter] < config) {
                        show = false;
                        if (!show) {
                            break;
                        }
                    }
                }
            }

            video.style.display = show ? 'inline-block' : 'none';
        }
    }

    updatePageContent(videos, pageSelector) {
        // Add videos to the page
        let currentVideos = document.getElementsByClassName('videos')[0];
        if (videos) {
            Array.from(videos.children).forEach(video => {
                currentVideos.appendChild(video);
                this.updateVideoDetail(video);
                this.updateVideoEvents(video);
            });
        }

        // Replace page selector content
        let pageSelectorId = 'pageSelectorThumbnail';
        let showPageSelector = GM_getValue(pageSelectorId, 'none') != 'block' ? 'none' : 'block';
        document.getElementsByClassName('page_selector')[0].innerHTML = pageSelector.innerHTML;
        document.getElementsByClassName('page_selector')[0].id = pageSelectorId;
        document.getElementsByClassName('page_selector')[0].style.display = showPageSelector;
    }

    async updateVideoDetail(video) {
        if (video.id.includes('vid_')) {
            let request = {url: `/cn/?v=${video.id.substring(4)}`};
            let response = await xhrFetchWithRetry(request).catch(err => {GM_log(err); return;});
            let responseText = await response.text().catch(err => {GM_log(err); return;});
            let videoDetailsDoc = parseHTMLText(responseText);

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
                if (!(video.id in this.videoStats)) {
                    this.videoStats[video.id] = {};
                }
                this.videoStats[video.id]['minScore'] = parseFloat(videoScore);
            }

            // Video watched
            let videoWatched = '0';
            if (videoDetailsDoc.getElementById('watched')) {
                videoWatched = videoDetailsDoc.getElementById('watched').getElementsByTagName('a')[0].innerText;
                if (!(video.id in this.videoStats)) {
                    this.videoStats[video.id] = {};
                }
                this.videoStats[video.id]['minViewer'] = parseFloat(videoWatched);
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

            // Apply filter
            this.applyFilterOn(video.id);
        }
    }

    updateVideoEvents(video) {
        if (video) {
            // Prevent existing listeners https://stackoverflow.com/a/46986927/4214478
            video.addEventListener('mouseout', (event) => {
                event.stopImmediatePropagation();
                video.getElementsByClassName('toolbar')[0].style.display = 'none';
            }, true);
            video.addEventListener('mouseover', (event) => {
                event.stopImmediatePropagation();
                video.getElementsByClassName('toolbar')[0].style.display = 'block';
            }, true); 
        }
    }

    async getNextPage(url) {
        // Update page URL and history
        history.pushState(history.state, window.document.title, url);

        // Fetch next page
        let response = await xhrFetchWithRetry({url: url}).catch(err => {GM_log(err); return;});
        let responseText = await response.text().catch(err => {GM_log(err); return;});
        let nextPageDoc = parseHTMLText(responseText);

        // Update page content
        let videos = nextPageDoc.getElementsByClassName('videos')[0];
        let pageSelector = nextPageDoc.getElementsByClassName('page_selector')[0];
        this.updatePageContent(videos, pageSelector);
    }
}

class MiniDriver {
    
    execute() {
        let javUrl = new URL(window.location.href);
        this.javVideoId = javUrl.searchParams.get('v');

        // Video page
        if (this.javVideoId != null) {
            this.addStyle();
            this.setEditionNumber();
            this.updateTitle();
            this.addScreenshot();
            this.addTorrentLinks();
            this.updateReviews();
            this.updateComments();
            this.getPreview();
        }
    }

    addStyle() {
        // left menu
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
                max-height: 80vh;
                display: block;
                margin-right: auto;
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
            let request = {url: `/en/?v=${this.javVideoId}`};
            let response = await xhrFetchWithRetry(request).catch(err => {GM_log(err); return;});
            let responseText = await response.text().catch(err => {GM_log(err); return;});
            let videoDetailsDoc = parseHTMLText(responseText);
            let englishTitle = videoDetailsDoc.getElementById('video_title')
                                    .getElementsByClassName('post-title')[0]
                                    .getElementsByTagName('a')[0].innerText;
            postTitle.innerHTML = `${postTitle.innerText}<br/>${englishTitle}`;
        }
    }

    scrollToTop(element) {
        let distanceToTop = element.getBoundingClientRect().top;
        if (distanceToTop < 0) {

            window.scrollBy(0, distanceToTop);
        }
    }

    screenShotOnclick(element) {
        if (element.style['max-width'] != '100%') {
            element.style['max-width'] = '100%';
        } else {
            element.style['max-width'] = '25%';
        }
        this.scrollToTop(element);
    }

    lazyScreenShotOnclick(element) {
        let currentSrc = element.src;
        element.src = element.dataset.src;
        element.dataset.src = currentSrc;
        element.style['max-width'] = '100%';
        this.scrollToTop(element);
    }

    async addScreenshot() {
        let javscreensUrl = `http://javscreens.com/images/${this.editionNumber}.jpg`;
        let videoDates = document.getElementById('video_date').getElementsByClassName('text')[0].innerText.split('-');
        let jbUrl = `http://img.japanese-bukkake.net/${videoDates[0]}/${videoDates[1]}/${this.editionNumber}_s.jpg`;
        for (let url of [javscreensUrl, jbUrl]) {
            let img = await this.loadImg(url).catch((img) => {return img;});
            if (img && img.naturalHeight > 200) {
                insertBefore(img, document.getElementById('rightcolumn').getElementsByClassName('socialmedia')[0]);
                img.addEventListener('click', () => this.screenShotOnclick(img));
                // Valid screenshot loaded, break the loop
                break;
            }
            removeElementIfPresent(img);
        }
    }

    loadImg(url) {
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: 'GET',
                responseType: 'blob',
                url: url,
                onload: (result) => {
                    if (result.status >= 200 && result.status < 300) {
                        let img = createElementFromHTML(`<img class="screenshot" title="">`);
                        insertBefore(img, document.getElementById('rightcolumn').getElementsByClassName('socialmedia')[0]);
                        img.src = window.URL.createObjectURL(result.response);
                        
                        img.onload = () => resolve(img);
                        img.onerror = () => reject(img);
                    } else {
                        reject();
                    }
                },
                onerror: reject,
                ontimeout: reject,
            });
        });
    }

    addTorrentLinks() {
        let sukebei = `https://sukebei.nyaa.si/?f=0&c=0_0&q=${this.editionNumber}`;
        let btsow = `https://btos.pw/search/${this.editionNumber}`;
        let javbus = `https://www.javbus.com/${this.editionNumber}`;
        let torrentKitty = `https://www.torrentkitty.tv/search/${this.editionNumber}`;
        let tokyotosho = `https://www.tokyotosho.info/search.php?terms=${this.editionNumber}`;
        let biedian = `https://biedian.me/search?source=%E7%A7%8D%E5%AD%90%E6%90%9C&s=time&p=1&k=${this.editionNumber}`;
        let btDigg = `http://btdig.com/search?q=${this.editionNumber}`;
        let idope = `https://idope.se/torrent-list/${this.editionNumber}/`;

        let torrentsHTML = `
            <div id="torrents">
                <!--
                <form id="form-btkitty" method="post" target="_blank" action="http://btkittyba.co/">
                    <input type="hidden" name="keyword" value="${this.editionNumber}">
                    <input type="hidden" name="hidden" value="true">
                </form>
                <form id="form-btdiggs" method="post" target="_blank" action="http://btdiggba.me/">
                    <input type="hidden" name="keyword" value="${this.editionNumber}">
                </form>
                -->
                <table>
                    <tr>
                        <td><strong>种子:</strong></td>
                        <td><a href="${sukebei}" target="_blank">sukebei</a></td>
                        <td><a href="${btsow}" target="_blank">btsow</a></td>
                        <td><a href="${javbus}" target="_blank">javbus</a></td>
                        <td><a href="${torrentKitty}" target="_blank">torrentKitty</a></td>
                        <td><a href="${tokyotosho}" target="_blank">tokyotosho</a></td>
                        <td><a href="${biedian}" target="_blank">biedian</a></td>
                        <td><a href="${btDigg}" target="_blank">btDigg</a></td>
                        <td><a href="${idope}" target="_blank">idope</a></td>
                        <!--
                        <td><a id="btkitty" href="JavaScript:Void(0);" onclick="document.getElementById('form-btkitty').submit();">btkitty</a></td>
                        <td><a id="btdiggs" href="JavaScript:Void(0);" onclick="document.getElementById('form-btdiggs').submit();">btdiggs</a></td>
                        -->

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
        let pageSelectorId = 'page_selector_' + pageType;
        let urlPath = 'video' + pageType;
        let elementsId = 'video_' + pageType;

        // Load more reviews
        let request = {url: `/cn/${urlPath}.php?v=${this.javVideoId}&mode=2&page=${page}`};
        let response = await xhrFetchWithRetry(request).catch(err => {GM_log(err); return;});
        let responseText = await response.text().catch(err => {GM_log(err); return;});
        let doc = parseHTMLText(responseText);

        // Remove the page selector div in current page
        let oldPageSelectorDiv = document.getElementById(pageSelectorId);
        if (oldPageSelectorDiv != null) {
            oldPageSelectorDiv.parentNode.removeChild(oldPageSelectorDiv);
        }

        // Get comments/reviews in the next page
        let elements = doc.getElementById(elementsId);
        if (!elements.getElementsByClassName('t')[0] || !doc.getElementsByClassName('page_selector')[0]) {
            return;
        }

        // Set element texts
        Array.from(elements.getElementsByClassName('t')).forEach(element => {
            let elementText = parseBBCode(escapeHtml(element.getElementsByTagName('textarea')[0].innerText));
            let elementHtml = createElementFromHTML(`<div>${parseHTMLText(elementText).body.innerHTML}</div>`);
            element.getElementsByClassName('text')[0].replaceWith(this.processUrls(elementHtml));
        });

        // Append elements to the page
        let currentElements = document.getElementById(elementsId);
        let bottomLine = currentElements.getElementsByClassName('grey')[0];
        Array.from(elements.children).forEach(element => {
            if (element.tagName == 'TABLE' || element.tagName == 'TD') {
                currentElements.insertBefore(element, bottomLine);
            }
        });

        // Append page selector
        let showPageSelector = GM_getValue(pageSelectorId, 'none') != 'block' ? 'none' : 'block';
        let pageSelector = doc.getElementsByClassName('page_selector')[0];
        if (pageSelector) {
            pageSelector.style.display = showPageSelector;
            pageSelector.id = pageSelectorId;
            let as = pageSelector.getElementsByTagName('a');
            for (let a of as) {
                let nextPage = (new URL(a.href, a.href.includes('https') ? undefined : 'https://www.javlibrary.com/')).searchParams.get('page');
                a.removeAttribute('href');
                a.style.cursor = 'pointer';
                a.addEventListener('click', async () => this.getNextPage(nextPage ? parseInt(nextPage) : 1, pageType));
            }
            insertAfter(pageSelector, currentElements);
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

    processUrls(content) {
        Array.from(content.getElementsByTagName('a')).forEach(a => {
            if (a.href.includes('redirect.php?url=')) {
                let encodedRealUrl = a.href.replace('redirect.php?url=', '');
                let realUrl = decodeURIComponent(encodedRealUrl);
                if (realUrl.indexOf('&ver=') > 0) {
                    realUrl = realUrl.substring(0, realUrl.indexOf('&ver='));
                }
                a.href = realUrl;
            }
        });
        return content;
    }

    extractContentIdFromPreviewThumbs() {
        try {
            // 1. Find previewthumbs div
            const previewThumbsDiv = document.querySelector('.previewthumbs');
            if (!previewThumbsDiv) {
                GM_log('previewthumbs div not found');
                return null;
            }

            // 2. Get all image URLs from the div
            const divContent = previewThumbsDiv.innerHTML;

            // 3. Extract content ID from image URL pattern
            // Pattern: https://pics.dmm.co.jp/digital/video/{contentId}/{contentId}jp-{number}.jpg
            const pattern = /https:\/\/pics\.dmm\.co\.jp\/digital\/video\/([a-zA-Z0-9]+)\/[a-zA-Z0-9]+jp-\d+\.jpg/g;
            const matches = divContent.match(pattern);

            if (!matches || matches.length === 0) {
                GM_log('No matching image URLs found in previewthumbs div');
                return null;
            }

            // 4. Parse content ID from first valid URL
            const firstUrl = matches[0];
            const contentIdMatch = firstUrl.match(/https:\/\/pics\.dmm\.co\.jp\/digital\/video\/([a-zA-Z0-9]+)\//);

            if (!contentIdMatch || contentIdMatch.length < 2) {
                GM_log('Could not extract content ID from URL: ' + firstUrl);
                return null;
            }

            const contentId = contentIdMatch[1];

            GM_log('Extracted content ID from previewthumbs: ' + contentId);
            return contentId;

        } catch (error) {
            GM_log('Error extracting content ID from previewthumbs: ' + error);
            return null;
        }
    }

    async extractContentIdFromSearchApi() {
        try {
            // Use search API from test.js reference implementation
            const javId = this.editionNumber;
            const url = `https://search.javtrailers.com/indexes/videos/search?q=${javId}&page=1&sort=releaseDate:desc&hitsPerPage=1`;

            GM_log('Trying search API for content ID: ' + javId);

            const response = await gmFetch({
                url: url,
                timeout: 10000, // 10 second timeout
                headers: {
                    "authorization": "Bearer e8f7f0a9891342bcde8aeee404526aa3c94ba743b914d1211456201d64318788"
                }
            });

            if (response.status >= 200 && response.status < 300) {
                const data = JSON.parse(response.responseText);

                // Extract content ID from API response (pattern from test.js)
                if (data.hits && data.hits.length > 0 && data.hits[0].contentId) {
                    const contentId = data.hits[0].contentId;
                    GM_log('Extracted content ID from search API: ' + contentId);
                    return contentId;
                } else {
                    GM_log('No content ID found in search API response');
                    return null;
                }
            } else {
                GM_log('Search API request failed with status: ' + response.status);
                return null;
            }
        } catch (error) {
            GM_log('Error extracting content ID from search API: ' + error);
            return null;
        }
    }


    async extractVideoUrlFromJavTrailers(contentId) {
        try {
            // Fetch the javtrailers page with timeout
            const url = `https://javtrailers.com/video/${contentId}`;
            const response = await gmFetch({
                url: url,
                timeout: 10000 // 10 second timeout
            });

            if (response.status >= 200 && response.status < 300) {
                const html = response.responseText;

                // Find the __NUXT_DATA__ script tag
                const nuxtDataMatch = html.match(/<script type="application\/json" id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

                if (nuxtDataMatch && nuxtDataMatch[1]) {
                    try {
                        const nuxtData = JSON.parse(nuxtDataMatch[1]);

                        // The JSON is a complex array where numeric indices reference other positions
                        // We need to find the trailerG reference and then look up the actual value

                        // First, let's try to find the trailerG reference in the array
                        // The structure appears to be: [array with data...]
                        // We need to search through the array for an object containing "trailerG"

                        function findTrailerGReference(arr) {
                            for (let i = 0; i < arr.length; i++) {
                                const item = arr[i];
                                if (typeof item === 'object' && item !== null) {
                                    // Check if this object has trailerG property
                                    if ('trailerG' in item) {
                                        return item.trailerG; // This should be a numeric index
                                    }

                                    // Search recursively in nested objects
                                    if (Array.isArray(item)) {
                                        const result = findTrailerGReference(item);
                                        if (result !== null) return result;
                                    } else if (typeof item === 'object') {
                                        // Search in object values
                                        for (const key in item) {
                                            if (typeof item[key] === 'object' && item[key] !== null) {
                                                if ('trailerG' in item[key]) {
                                                    return item[key].trailerG;
                                                }
                                            } else if (Array.isArray(item[key])) {
                                                const result = findTrailerGReference(item[key]);
                                                if (result !== null) return result;
                                            }
                                        }
                                    }
                                }
                            }
                            return null;
                        }

                        const trailerGIndex = findTrailerGReference(nuxtData);

                        if (trailerGIndex !== null && typeof trailerGIndex === 'number') {
                            // The index should point to the actual URL in the array
                            if (trailerGIndex >= 0 && trailerGIndex < nuxtData.length) {
                                const trailerGUrl = nuxtData[trailerGIndex];
                                if (typeof trailerGUrl === 'string' && trailerGUrl.startsWith('http')) {
                                    GM_log(`Found trailerG URL at index ${trailerGIndex}: ${trailerGUrl}`);
                                    return trailerGUrl;
                                }
                            }
                        }

                        // Alternative approach: search for the URL pattern directly in the JSON string
                        // Look for "trailerG": followed by a number, then find that index in the array
                        const trailerGPattern = /"trailerG"\s*:\s*(\d+)/;
                        const trailerGMatch = nuxtDataMatch[1].match(trailerGPattern);

                        if (trailerGMatch && trailerGMatch[1]) {
                            const index = parseInt(trailerGMatch[1]);
                            if (index >= 0 && index < nuxtData.length) {
                                const trailerGUrl = nuxtData[index];
                                if (typeof trailerGUrl === 'string' && trailerGUrl.startsWith('http')) {
                                    GM_log(`Found trailerG URL via index ${index}: ${trailerGUrl}`);
                                    return trailerGUrl;
                                }
                            }
                        }

                        // Fallback: search for media.javtrailers.com URLs in the entire JSON
                        const mediaUrlPattern = /https:\/\/media\.javtrailers\.com\/[^"]+/g;
                        const mediaUrls = nuxtDataMatch[1].match(mediaUrlPattern);
                        if (mediaUrls && mediaUrls.length > 0) {
                            // Return the first media.javtrailers.com URL
                            GM_log(`Found media.javtrailers.com URL: ${mediaUrls[0]}`);
                            return mediaUrls[0];
                        }

                        // Last resort: search for any video URL pattern
                        const videoUrlPattern = /https:\/\/[^"]+\.(mp4|m3u8|webm)[^"]*/gi;
                        const videoUrls = nuxtDataMatch[1].match(videoUrlPattern);
                        if (videoUrls && videoUrls.length > 0) {
                            // Prefer media.javtrailers.com URLs
                            const mediaUrl = videoUrls.find(url => url.includes('media.javtrailers.com'));
                            if (mediaUrl) {
                                GM_log(`Found video URL: ${mediaUrl}`);
                                return mediaUrl;
                            }
                            // Otherwise return the first video URL
                            GM_log(`Found video URL: ${videoUrls[0]}`);
                            return videoUrls[0];
                        }

                    } catch (parseError) {
                        GM_log(`Error parsing NUXT data: ${parseError}`);

                        // Fallback: try to find trailerG URL in the entire HTML
                        const trailerGUrlPattern = /"trailerG"\s*:\s*"([^"]+)"/;
                        const trailerGUrlMatch = html.match(trailerGUrlPattern);
                        if (trailerGUrlMatch && trailerGUrlMatch[1]) {
                            GM_log(`Found trailerG URL via regex fallback: ${trailerGUrlMatch[1]}`);
                            return trailerGUrlMatch[1];
                        }
                    }
                }

                // Alternative: try to find video URLs in the entire HTML
                const videoUrlPattern = /https:\/\/[^"]+\.(mp4|m3u8|webm)[^"]*/gi;
                const videoUrls = html.match(videoUrlPattern);
                if (videoUrls && videoUrls.length > 0) {
                    // Prefer media.javtrailers.com URLs
                    const mediaUrl = videoUrls.find(url => url.includes('media.javtrailers.com'));
                    if (mediaUrl) {
                        GM_log(`Found video URL in HTML: ${mediaUrl}`);
                        return mediaUrl;
                    }
                    // Otherwise return the first video URL
                    GM_log(`Found video URL in HTML: ${videoUrls[0]}`);
                    return videoUrls[0];
                }

                GM_log('Could not find trailerG URL in javtrailers page');
                return null;
            } else {
                GM_log(`Failed to fetch javtrailers page: ${response.status}`);
                return null;
            }
        } catch (error) {
            GM_log(`Error extracting video URL: ${error}`);
            return null;
        }
    }

    async getPreview() {
        // Helper function to create video preview
        const createVideoPreview = (videoUrl) => {
            // Create video element
            const videoElement = document.createElement('video');
            videoElement.src = videoUrl;
            videoElement.controls = true;
            videoElement.volume = 0.5;

            // Create preview container
            const previewContainer = document.createElement('div');
            previewContainer.id = 'preview';
            previewContainer.appendChild(videoElement);

            // Insert after torrents section
            insertAfter(previewContainer, document.getElementById('torrents'));

            GM_log('Video preview added successfully');
        };

        // 1. Try primary method (extract from previewthumbs div)
        let contentId = this.extractContentIdFromPreviewThumbs();

        // 2. Try to get video with extracted content ID
        if (contentId) {
            const videoUrl = await this.extractVideoUrlFromJavTrailers(contentId);
            if (videoUrl) {
                // Success - create video preview
                createVideoPreview(videoUrl);
                return;
            }
            // Video extraction failed - content ID is invalid
            GM_log('Primary content ID extraction failed, trying search API');
        } else {
            GM_log('Could not extract content ID from previewthumbs div, trying search API');
        }

        // 3. Try search API method
        contentId = await this.extractContentIdFromSearchApi();
        if (contentId) {
            const videoUrl = await this.extractVideoUrlFromJavTrailers(contentId);
            if (videoUrl) {
                // Success - create video preview
                createVideoPreview(videoUrl);
                return;
            }
            // Video extraction failed - content ID is invalid
            GM_log('Search API content ID extraction failed');
        }

        // 4. All methods failed
        GM_log('Could not extract valid content ID using any method');
    }

    includesEditionNumber(str) {
        return str != null
                // && str.includes(this.editionNumber.toLowerCase().split('-')[0])
                && str.includes(this.editionNumber.toLowerCase().split('-')[1]);
    }

    async getDmmCid() {
        let getCidFromUrl = (url) => {
            if (url.includes('dmm.co.jp') && this.includesEditionNumber(url)) {
                let cid = url.split('/').at(-2);
                return cid;
            }
        }

        let profileImageUrl = document.getElementById('video_jacket_img').src;
        let cid = getCidFromUrl(profileImageUrl);
        if (cid !== null) {
            return cid;
        }
        
        let urlPattern = /(http|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/g;
        for (let url of document.body.innerHTML.match(urlPattern)) {
            cid = getCidFromUrl(url);
            if (cid != null) {
                return cid;
            }
        }

        let getCidFromSearchEngine = async (searchUrl) => {
            let request = {url: searchUrl};
            let response = await gmFetch(request).catch(err => {GM_log(err); return;});
            let pattern = /(cid=[\w]+|pid=[\w]+)/g;
            for (let match of response.responseText.match(pattern)) {
                if (this.includesEditionNumber(match)) {
                    return match.replace(/(cid=|pid=)/, '');
                }
            }
        }

        // Find dmm cid from search engines
        let bingCid = getCidFromSearchEngine(`https://www.bing.com/search?q=${this.editionNumber.toLowerCase()}+site%3awww.dmm.co.jp`);
        if (bingCid != null) {
            return bingCid;
        }

        let googleCid = await getCidFromSearchEngine(`https://www.google.com/search?q=${this.editionNumber}+site%3Awww.dmm.co.jp`);
        if (googleCid != null) {
            return googleCid;
        }
    }
}

// Need `// @run-at      document-start` to override the default addEventListener
// Check https://stackoverflow.com/a/26269087/4214478 and https://stackoverflow.com/a/57437878/4214478
// EventTarget.prototype.addEventListenerBase = EventTarget.prototype.addEventListener;
// EventTarget.prototype.addEventListener = function(type, listener) {
//     if (this == document && type == 'click') {
//         GM_log('Prevent adding click event on "document" element. Event listener: ' + listener.toString());
//         return;
//     }
//     this.addEventListenerBase(type, listener);
// };

function blockAds() {
    // Not open ad url
    // https://stackoverflow.com/a/9172526
    // https://stackoverflow.com/a/4658196

    let adSites = ['yuanmengbi', 'zhaijv', 'henanlvyi'];

    let scope = (typeof unsafeWindow === "undefined") ? window : unsafeWindow;
    scope.open = function(open) {
        return function(url, name, features) {
            if (adSites.some(site => url.includes(site))) {
                return;
            }
            return open.call(scope, url, name, features);
        };
    }(scope.open);
}

// Block ad
blockAds();

// Adult check
setCookie('over18', 18);

// Style change
addStyle();
if (!window.location.href.includes('.php')
        && (window.location.href.includes('?v=') || window.location.href.includes('&v='))) {
    new MiniDriver().execute();
} else {
    new MiniDriverThumbnail().execute();
}
