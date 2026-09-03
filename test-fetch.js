import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  try {
    console.log('Testing browse/list page...');
    const browseUrl = 'https://pastpapers.ku.ac.ke/handle/123456789/5?mode=full';
    console.log('URL:', browseUrl);
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(45000);
    
    await page.goto(browseUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));
    
    const html = await page.content();
    
    console.log('\n=== PAGE CONTENT ===');
    console.log('HTML length:', html.length);
    console.log('Contains bitstream:', html.includes('bitstream'));
    console.log('Contains .pdf:', html.includes('.pdf'));
    console.log('Contains /handle/:', html.includes('/handle/'));
    
    // Find PDF links
    const pdfUrls = html.match(/href=["']([^"']*\.pdf[^"']*?)["']/gi) || [];
    console.log('\nFound PDF hrefs:', pdfUrls.length);
    pdfUrls.slice(0, 3).forEach(url => console.log('  -', url));
    
    // Find bitstream links
    const bitstreamLinks = html.match(/\/bitstream\/handle\/[^\s"'<>]*(?:\?[^\s"'<>]*)?/g) || [];
    console.log('\nFound bitstream links:', bitstreamLinks.length);
    bitstreamLinks.slice(0, 5).forEach(link => console.log('  -', link));
    
    fs.writeFileSync('./test-browse.html', html);
    console.log('\nHTML saved to test-browse.html');
    
    await browser.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
