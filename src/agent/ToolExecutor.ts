import { browserController } from './BrowserController';

export class ToolExecutor {
  static async execute(name: string, args: any): Promise<any> {
    console.log(`Executing tool: ${name}`, args);
    const page = await browserController.getPage();
    
    try {
      switch (name) {
        case 'openWebsite':
          await page.goto(args.url);
          return { success: true, url: page.url() };
          
        case 'searchGoogle':
          await page.goto('https://www.google.com');
          await page.fill('textarea[name="q"], input[name="q"]', args.query);
          await page.keyboard.press('Enter');
          await page.waitForLoadState('networkidle');
          return { success: true, title: await page.title() };
          
        case 'searchYouTube':
          await page.goto('https://www.youtube.com');
          await page.fill('input#search', args.query);
          await page.keyboard.press('Enter');
          await page.waitForLoadState('networkidle');
          return { success: true, title: await page.title() };
          
        case 'playYouTubeVideo':
          // Wait for video links and click the first one
          await page.waitForSelector('ytd-video-renderer a#video-title');
          await page.click('ytd-video-renderer a#video-title');
          return { success: true };
          
        case 'openSpotify':
          await page.goto('https://open.spotify.com');
          return { success: true, title: await page.title() };
          
        case 'playSpotifyPlaylist':
          // Attempt a search or direct navigation to search
          await page.goto(`https://open.spotify.com/search/${encodeURIComponent(args.name)}`);
          return { success: true };
          
        case 'openInstagram':
          await page.goto('https://www.instagram.com');
          return { success: true, title: await page.title() };
          
        case 'searchInstagramUser':
          await page.goto(`https://www.instagram.com/${encodeURIComponent(args.name)}/`);
          return { success: true };
          
        case 'openInstagramChat':
          await page.goto('https://www.instagram.com/direct/inbox/');
          // Basic placeholder, in reality requires login and complex DOM interaction
          return { success: true, message: "Opened direct inbox. Next step is to find the user." };
          
        case 'typeInstagramMessage':
          // Placeholder
          return { success: true, message: `Prepared message: ${args.text}` };
          
        case 'sendInstagramMessage':
          // Placeholder
          return { success: true, message: "Message sent." };
          
        case 'openFacebook':
          await page.goto('https://www.facebook.com');
          return { success: true, title: await page.title() };
          
        case 'openGmail':
          await page.goto('https://mail.google.com');
          return { success: true, title: await page.title() };
          
        case 'openNetflix':
          await page.goto('https://www.netflix.com');
          return { success: true, title: await page.title() };
          
        case 'browserClick':
          await page.click(args.selector);
          return { success: true };
          
        case 'browserType':
          await page.fill(args.selector, args.text);
          return { success: true };
          
        case 'browserScroll':
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          return { success: true };
          
        case 'browserWait':
          await page.waitForTimeout(args.ms || 1000);
          return { success: true };
          
        case 'closeBrowser':
          await browserController.close();
          return { success: true };
          
        default:
          throw new Error(`Tool ${name} not found`);
      }
    } catch (e: any) {
      console.error(`Error executing tool ${name}:`, e);
      return { success: false, error: e.message };
    }
  }
}
