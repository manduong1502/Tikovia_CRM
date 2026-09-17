import axios from 'axios';

async function check() {
  const res = await axios.get('https://crm.tikovia.vn');
  const html = res.data;
  console.log('HTML snippet:', html.slice(0, 300));
  const match = html.match(/\/assets\/index-[a-zA-Z0-9_-]+\.js/);
  if (match) {
    const jsUrl = 'https://crm.tikovia.vn' + match[0];
    console.log('JS URL:', jsUrl);
    const jsRes = await axios.get(jsUrl);
    if (jsRes.data.includes('prghikcgrgjsdowmnyzs')) {
      console.log('🎉 PROD BUNDLE HAS NEW SUPABASE URL: prghikcgrgjsdowmnyzs!');
    } else {
      console.log('⚠️ Old bundle or cached');
    }
  }
}

check();
