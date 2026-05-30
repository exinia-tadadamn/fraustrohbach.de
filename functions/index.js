const functions = require('firebase-functions');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

exports.scrapeInstagram = functions.https.onCall(async (data, context) => {
    const { url } = data;
    if (!url || !url.includes('instagram.com')) {
        throw new functions.https.HttpsError('invalid-argument', 'Valid Instagram URL required');
    }

    let browser = null;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for content to load
        await page.waitForTimeout(3000);

        // Extract data
        const result = await page.evaluate(() => {
            // Try to get images
            const images = [];
            const imgSelectors = [
                'article img[srcset]',
                'article img[src*="instagram.com"]',
                'meta[property="og:image"]'
            ];

            // Get meta image
            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) images.push(ogImage.content);

            // Get article images (highest res)
            const articleImgs = Array.from(document.querySelectorAll('article img'));
            articleImgs.forEach(img => {
                const src = img.getAttribute('src') || img.currentSrc;
                if (src && !images.includes(src)) images.push(src);
            });

            // Get caption from meta description
            let caption = '';
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) caption = metaDesc.content;

            // Try to get better caption from JSON-LD
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            let datePublished = '';
            for (const s of scripts) {
                try {
                    const json = JSON.parse(s.textContent);
                    if (json.caption) caption = json.caption;
                    if (json.datePublished) datePublished = json.datePublished;
                } catch (e) {}
            }

            // Fallback: try to get caption from article text
            if (!caption) {
                const articleText = document.querySelector('article span[data-selectable-text]');
                if (articleText) caption = articleText.textContent;
            }

            // Get username
            let username = '';
            const userMeta = document.querySelector('meta[property="og:title"]');
            if (userMeta) {
                const match = userMeta.content.match(/@(\w+)/);
                if (match) username = match[1];
            }

            return { images, caption, datePublished, username };
        });

        await browser.close();
        browser = null;

        return {
            success: true,
            images: result.images.slice(0, 5),
            caption: result.caption,
            datePublished: result.datePublished,
            username: result.username,
            sourceUrl: url
        };
    } catch (error) {
        if (browser) await browser.close();
        console.error('Scrape error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to scrape Instagram: ' + error.message);
    }
});
