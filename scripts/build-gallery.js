const fs = require('fs');
const path = require('path');

function buildGalleryFor(siteDir) {
    const imageDir = path.join(__dirname, '..', siteDir, 'imagesTimeMashine');
    if (!fs.existsSync(imageDir)) {
        console.warn(`Directory ${imageDir} does not exist, skipping.`);
        return;
    }
    const files = fs.readdirSync(imageDir)
        .filter(f => /\.(jpg|jpeg|png|webp|gif|JPG|JPEG|PNG|WEBP|GIF)$/i.test(f))
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
            const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
            return numA - numB;
        });

    const images = files.map((f, i) => ({
        src: `imagesTimeMashine/${f}`,
        filename: f,
        order: i + 1
    }));

    const outPath = path.join(__dirname, '..', siteDir, 'gallery-images.json');
    fs.writeFileSync(outPath, JSON.stringify({
        images,
        coverImage: images[0]?.src || ''
    }, null, 2));
    console.log(`Wrote ${images.length} images to ${siteDir}/gallery-images.json`);
}

buildGalleryFor('fraustrohbach.de');
buildGalleryFor('fraustrohbachde');
