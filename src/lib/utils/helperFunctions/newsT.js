import { waitForAll } from './multiPromise';
import { get } from 'svelte/store';
import {news} from '$lib/stores';
import { dynasty } from '$lib/utils/leagueInfo';


const Texans = 'https://www.reddit.com/r/Texans/new.json';


export const getNewsT = async (bypass = false) => {
	if(get(news)[0] && !bypass) {
		return {articles: get(news), fresh: false};
	}
	const newsSources = [
		getFeed(NBC_URL, processNBC),
		fetch(SERVER_API, {compress: true}),
	];
	if(dynasty) {
		newsSources.push(getFeed(Texans, processReddit));
	} else {
		newsSources.push(getFeed(REDDIT_FANTASY, processReddit));
	}

	const [nbcNews, serverRes, reddit] = await waitForAll(...newsSources).catch((err) => { console.error(err); });
	const serverData = await serverRes.json().catch((err) => { console.error(err); });

	const articles = [...nbcNews, ...reddit, ...serverData].sort((a, b) => (a.ts < b.ts) ? 1 : -1);
	news.update(() => articles);

	return {articles, fresh: true};
}

const getFeed = async (feed, callback) => {
	const res = await fetch(feed, {compress: true}).catch((err) => { console.error(err); });
	const data = await res.json().catch((err) => { console.error(err); });
	
	if (res.ok) {
		return callback(data.data);
	} else {
		throw new Error(data);
	}
}

const processNBC = (rawArticles) => {
	let finalArticles = [];
	for(const rawArticle of rawArticles) {
		const ts = Date.parse(rawArticle.attributes.changed);
		const d = new Date(ts);
		const date = stringDate(d);
		finalArticles.push({
			title: rawArticle.attributes.headline,
			article: `${rawArticle.attributes.news.processed}${rawArticle.attributes.analysis ? rawArticle.attributes.analysis.processed : ''}`,
			link: rawArticle.attributes.source_url,
			author: rawArticle.attributes.source,
			ts,
			date,
			icon: 'newsIcons/nbcSportsEdge.jpeg',
		});
	}
	return finalArticles;
}

const processReddit = (rawArticles) => {
	const bannedAuthors = [
		"AutoModerator",
		"FFBot",
		"Brookskbrothers",
		"FTAKJ"
	]
	const bannedIcons = [
		"",
		"self",
		"thumbnail",
		"default",
	]
	let finalArticles = [];
	const children = rawArticles.children;
	for(const rawArticle of children) {
		const data = rawArticle.data;
		if(bannedAuthors.includes(data.author)) {
			continue;
		}
		const ts = data.created_utc * 1000;
		const d = new Date(ts);
		const icon = !bannedIcons.includes(data.thumbnail) ? data.thumbnail : `newsIcons/${data.subreddit}.png`;
		const date = stringDate(d);
		let article = `<a href="${data.url}" class="body-link">${data.url}</a>`;
		if(data.selftext_html) {
			article = decodeHTML(data.selftext_html);
		}
		if(data.secure_media_embed?.content) {
			decodeHTML(data.secure_media_embed.content)
		 }
		finalArticles.push({
			title: data.title,
			article,
			link: `https://www.reddit.com${data.permalink}`,
			author: `${data.subreddit_name_prefixed} - u/${data.author}`,
			ts,
			date,
			icon,
		});
	}
	return finalArticles;
}

var htmlEntities = {
    nbsp: ' ',
    cent: '¢',
    pound: '£',
    yen: '¥',
    euro: '€',
    copy: '©',
    reg: '®',
    lt: '<',
    gt: '>',
    quot: '"',
    amp: '&',
    apos: '\''
};

function decodeHTML(str) {
    return str.replace(/\&([^;]+);/g, function (entity, entityCode) {
        let match;

        if (entityCode in htmlEntities) {
            return htmlEntities[entityCode];
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
            return String.fromCharCode(parseInt(match[1], 16));
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#(\d+)$/)) {
            return String.fromCharCode(~~match[1]);
        } else {
            return entity;
        }
    });
};

export const stringDate = (d) => {
	return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()} ${d.getHours() % 12}:${(d.getMinutes() < 10 ? '0' : '') + d.getMinutes()}${d.getHours() / 12 >= 1 ? "PM" : "AM"}`;
}
