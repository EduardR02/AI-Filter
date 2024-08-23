const max_tokens = 4000;
const postQueue = [];
const POST_THRESHOLD = 5; // Make an API call every 5 new posts
const processedPosts = new Set();
const postMap = new Map();
const test_mode = false;
const logging = false;
let settings = {};


init();


function init() {
    get_on_off(function (isOn) {
        if (init_on_off(isOn)) {
            init_settings()
                .then(() => {
                    observe_change();
                    // Initial processing of existing content
                    const initialPosts = extractPostsFromNode(document);
                    if (initialPosts.length > 0) {
                        postQueue.push(...initialPosts);
                        processPosts();
                    }
                })
                .catch(() => {
                    console.log("Crucial value not set. Please visit the settings page to configure the extension.");
                });

        }
    });
}

function init_settings() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['api_key', 'temperature', 'threshold', 'prompt'])
            .then(res => {
                settings = {
                    api_key: res.api_key || "",
                    temperature: res.temperature || 0.5,
                    threshold: res.threshold || 7,
                    prompt: res.prompt || ""
                };
                chrome.storage.onChanged.addListener(update_settings);
                if (!settings.api_key || !settings.prompt) {
                    reject(new Error("API key or prompt not set"));
                } else {
                    settings.prompt = [{ role: "system", content: settings.prompt }];
                    resolve();
                }
            });
    });
}


function update_settings(changes, namespace) {
    if (namespace !== "local") return;
    for (let [key, { newValue }] of Object.entries(changes)) {
        if (key in settings && key !== "lifetime_tokens" && key !== "OnOffToggle") {
            settings[key] = newValue;
        }
    }
}


function observe_change() {
    let canExtract = true;
    const COOLDOWN = 1000; // 1 second cooldown

    let observer = new MutationObserver(mutations => {
        let shouldExtract = false;
        for (let mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldExtract = true;
                break;
            }
        }

        if (shouldExtract && canExtract) {
            canExtract = false;

            // Immediate processing
            let newPosts = extractPostsFromNode(document.body);
            if (newPosts.length > 0) {
                postQueue.push(...newPosts);
                if (postQueue.length >= POST_THRESHOLD) {
                    processPosts();
                }
            }
            // Set cooldown
            setTimeout(() => {
                canExtract = true;
            }, COOLDOWN);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
}


function getFeedContainer() {
    if (window.location.hostname.includes('reddit.com')) {
        return document.querySelector('[data-testid="post-list-page"]') || document.body;
    } else if (window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com')) {
        return document.querySelector('[data-testid="primaryColumn"]') || document.body;
    } else if (window.location.hostname.includes('youtube.com')) {
        return document.querySelector('ytd-rich-grid-renderer') || document.body;
    }
    return document.body;
}


function extractPostsFromNode(node) {
    let newPosts;
    if (window.location.hostname.includes('reddit.com')) {
        newPosts = extractRedditPosts(node);
    } else if (window.location.hostname.includes('twitter.com')) {
        newPosts = extractTwitterPosts(node);
    } else if (window.location.hostname.includes('youtube.com')) {
        newPosts = extractYouTubeVideos(node);
    } else {
        newPosts = [];
    }
    return newPosts;
}


function processPosts() {
    const localQueue = [...postQueue];
    const content = localQueue.map((post, index) => `Post ${index}:\n${post.content}`).join('\n\n');
    api_call([{role: "user", content: content}], localQueue);
    postQueue.length = 0;
}




function api_call(content, posts) {
    const [api_link, requestOptions] = create_openai_request(content);
    fetch(api_link, requestOptions)
        .then(response => get_reponse_no_stream(response, posts))
        .catch(error => console.log("api request (likely incorrect key) " + error.message));
}


function create_openai_request(content) {
    const message = settings.prompt.concat(content);
    const schema = {
        name: "filtered_content",
        strict: true,
        type: "object",
        properties: {
            post_scores: {
                try: "array",
                items: {
                    type: "object",
                    properties: {
                        explanation: {
                            type: "string",
                            description: "Extremely brief explanation of how this filter score was chosen."
                        },
                        filter_score: {
                            type: "number",
                            description: "Score from 1 to 10 for how probable it is that this content should be filtered."
                        },
                    },
                    additionalProperties: false,
                    required: ["explanation", "filter_score"],
                },
            },
        },
        additionalProperties: false,
        required: ["post_scores"]
    };
    const requestOptions = {
        method: 'POST',
        credentials: 'omit',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + settings.api_key
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: message,
            max_tokens: max_tokens,
            temperature: settings.temperature,
            stream: false,
            response_format: { type: "json_schema", json_schema: {"name": "filtered_content", "schema": schema } }
        })
    };
    return ['https://api.openai.com/v1/chat/completions', requestOptions];
}


function get_reponse_no_stream(response, posts) {
    response.json().then(data => {
        let [response_text, input_tokens, output_tokens] = get_response_data_no_stream(data);
        set_lifetime_tokens(input_tokens, output_tokens);
        const result = JSON.parse(response_text).post_scores;
        if (!result) {
            return;
        }
        if (logging) console.log(result);
        // Assume the API returns an array of scores matching the order of input posts
        try {
            result.forEach((item, index) => {
                const postId = posts[index]?.id;
                if (!postId) {
                    return;
                }
                if (logging) console.log(`Post: \n${posts[index].content} \nscore: ${item.filter_score}\n`);

                const postData = postMap.get(postId);
                if (postData) {
                    postMap.delete(postId);
                    filterContent(postData.element, item.filter_score);
                }
            });
        }
        catch (error) {
            console.log("error in processing response: " + error.message);
        }
    });
}


function extractTwitterPosts(node) {
    const tweets = node.querySelectorAll('[data-testid="tweet"]');
    let new_tweets = [];
    for (const tweet of tweets) {
        const tweetElements = tweet.querySelectorAll('[data-testid="tweetText"]');
        const tweetElement = tweetElements[0];
        const id = tweetElement?.getAttribute('id');
        let content = tweetElement?.textContent || '';
        if (!id || processedPosts.has(id) || (!content && tweetElements.length < 2)) {
            continue;
        }
        if (tweetElements.length > 1 && tweetElements[1]?.textContent) {
            content += '\nQuoted tweet:' + tweetElements[1].textContent;
        }
        processedPosts.add(id);
        postMap.set(id, { element: tweet, content: content });
        new_tweets.push({ id: id, content: content });
    }
    return new_tweets;
}


function extractRedditPosts(node) {
    const posts = node.querySelectorAll('shreddit-post');
    let new_posts = [];
    for (const post of posts) {
        const sub_name = post.getAttribute('subreddit-prefixed-name');
        let title = post.querySelector('[slot="title"]')?.textContent || '';
        let bodyText = post.querySelector('[slot="text-body"]')?.textContent || '';
        if (bodyText) {
            bodyText = bodyText.trim();
            if (bodyText.length > 100) {
                bodyText = bodyText.substring(0, 100).trim() + '...';
            }
            bodyText = "Post: " + bodyText;
        }
        title = title ? "Title: " + title.trim() : '';
        const id = post.getAttribute('id');
        const content = `Sub: ${sub_name}\n${title}\n${bodyText}`.trim();
        if (!id || processedPosts.has(id) || !content) {
            continue;
        }
        processedPosts.add(id);
        // for deletion might need to get the parent instead
        const parent = post.parentNode;
        postMap.set(id, { element: parent, content: content });
        new_posts.push({ id: id, content: content });
    }
    return new_posts;
}


function extractYouTubeVideos(node) {
    const videoItems = node.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer');
    let new_videos = [];
    for (const item of videoItems) {
        const videoElement = item.querySelector('#video-title');
        const channelElement = item.querySelector('#text.ytd-channel-name');
        const title = videoElement?.textContent?.trim() || '';
        const channel = channelElement?.textContent?.trim() || '';

        const href = item.querySelector('a#thumbnail')?.getAttribute('href') || '';
        const id = href.split('v=')[1]?.split('&')[0] || href.split('/shorts/')[1]?.split('?')[0] || '';
        const content = `Title: ${title}\nChannel: ${channel}`.trim();

        if (!id || processedPosts.has(id)) {
            continue;
        }
        
        processedPosts.add(id);
        postMap.set(id, { element: item, content: content });
        new_videos.push({ id: id, content: content });
    }
    return new_videos;
}


function get_response_data_no_stream(data) {
    return [data.choices[0].message.content, data.usage.prompt_tokens, data.usage.completion_tokens];
}


function filterContent(element, score) {
    if (score >= settings.threshold) {
        if (!test_mode) {
            element.style.display = 'none'; // Remove the content
        } else {
            // Find and color all text nodes red
            const textNodes = getTextNodes(element);
            textNodes.forEach(node => {
                const span = document.createElement('span');
                span.style.color = 'red';
                node.parentNode.insertBefore(span, node);
                span.appendChild(node);
            });
        }
    }
}


function getTextNodes(node) {
    const textNodes = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
    let currentNode;
    while (currentNode = walker.nextNode()) {
        if (currentNode.nodeValue.trim() !== '') {
            textNodes.push(currentNode);
        }
    }
    return textNodes;
}


function get_on_off(callback) {
    chrome.storage.local.get('OnOffToggle', function (res) {
        callback(res.OnOffToggle);
    });
}


function init_on_off(isOn) {
    if (isOn === undefined) {
        // by default will be set to on
        isOn = true;
        chrome.storage.local.set({ OnOffToggle: isOn });
    }
    return isOn;
}


function get_lifetime_tokens(callback) {
    chrome.storage.local.get(['lifetime_input_tokens', 'lifetime_output_tokens'], function(res) {
        callback({
            input: res.lifetime_input_tokens || 0,
            output: res.lifetime_output_tokens || 0
        });
    });
}


function set_lifetime_tokens(newInputTokens, newOutputTokens) {
    get_lifetime_tokens(function(currentTokens) {
        chrome.storage.local.set({
            lifetime_input_tokens: currentTokens.input + newInputTokens,
            lifetime_output_tokens: currentTokens.output + newOutputTokens
        });
    });
}