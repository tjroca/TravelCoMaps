const { Client } = require('@notionhq/client');
const fs = require('node:fs');
const puppeteer = require('puppeteer');


const NOTION_API_KEY = "secret_ObvGJnsOq39ZUhsK3BLXMDD97B8ijulgB1MKVYnL8Nm";
const MAPBOX_API_KEY = "pk.eyJ1IjoidGp4MCIsImEiOiJjbWQ2MmlqY3EwNHljMm5vbHZwYTRoN3ZyIn0.wt9RW0z9LrI5_-YvdYMC6g";
const DB_ID = "4284871d81114f6b83df38e648cd9a54";

const notion = new Client({ auth: NOTION_API_KEY });

// Define query to endpoint
let params = {
    "database_id": DB_ID,
        "filter": {
            "or": [
                {
                    "property": "Group",
                    "select": {
                        "equals": "Things to eat"
                    }
                },
                {
                    "property": "Group",
                    "select": {
                        "equals": "Things to see"
                    }
                },
                {
                    "property": "Type",
                    "multi_select": {
                        "contains": "Hotel"
                    }
                }
            ]
        }
}


async function getPages() {

    let allDBEntries = [];
    keep_pulling = true;

    do {
        // Send query to endpoint
        const response = await notion.databases.query({ ...params });
        // Object.assign(allDBEntries, response.results);
        allDBEntries.push(...response.results);

        // Check if the response has more data
        if (response.has_more == true) {
            Object.assign(params, {"start_cursor": response.next_cursor} );
        } else {
            keep_pulling = false;
        }
    } while (keep_pulling == true);

    console.log(allDBEntries.length);
    return allDBEntries;
}

async function resolveRedirects(shortUrl) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(shortUrl, { waitUntil: 'networkidle2' });

    // Wait until the browser redirects internally to the real place page
    await page.waitForFunction(
        () => location.href.includes('/place/') && location.href.includes('@'),
        { timeout: 10000 }
    );

    const finalUrl = await page.evaluate(() => window.location.href);

    await browser.close();
    return finalUrl
}

function extractCoordinates(url) {
    // Use the '3d' and '4d' identifiers at the end of the URL to pull coordinates (not the ones after the '@')
    const coordinatesMatch = url.match(/!3d([-+]?[0-9]*\.?[0-9]+)!4d([-+]?[0-9]*\.?[0-9]+)/);
        if (coordinatesMatch) {
            destinationLatitude = parseFloat(coordinatesMatch[1]);
            destinationLongitude = parseFloat(coordinatesMatch[2]);
        } else {
            console.error(`Coordinates not found in the URL.\n${url}\n`);
        }
        
        return { destinationLatitude, destinationLongitude };
}

async function processNotionEntries(allDBEntries) {
    let destinations = []
    
    for (let i = 0; i < allDBEntries.length; i ++) {
        try {
            let destinationTitle = allDBEntries[i].properties.Name.title[0].plain_text;
            let destinationMap = allDBEntries[i].properties.Maps.rich_text[0].plain_text;
            let destinationGroup = allDBEntries[i].properties.Group.select.name
        
            let expandedUrl = await resolveRedirects(destinationMap);

            let { destinationLatitude, destinationLongitude } = extractCoordinates(expandedUrl);

            
            // Push new object to list
            destinations.push( {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [destinationLongitude, destinationLatitude]
                },
                "properties": {
                    "Type": destinationGroup,
                    "Name": destinationTitle,
                    "Google Maps": destinationMap
                }
            } )

            console.log(`${i} - ${JSON.stringify(destinations[i])}`);
        } catch (error) {
            console.error(`Error while parsing DB entries:\n${error}`);
            console.error(allDBEntries[i]);
            continue;
        }
    }

    // Format for final GeoJSON
    let destinationsGeoJSObj = {
        "type": "FeatureCollection",
        "features": destinations
    }

    return destinationsGeoJSObj;
}





async function main() {
    // Retrieve relevant details from Notion DB
    let allDBEntries = await getPages();

    // Processes Notion entries and formats to necessary GeoJSON format
    let destinationsGeoJSObj = await processNotionEntries(allDBEntries);

    // Write the GeoJSON object to a file
    await fs.promises.writeFile('output.geojson', JSON.stringify(destinationsGeoJSObj, null, 2));

    // await uploadToMapbox(MAPBOX_API_KEY, destinationsGeoJSObj);
    
} main();

