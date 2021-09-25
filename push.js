const fs = require('fs').promises;
const open = require('open');
const cheerio = require('cheerio');

(async ()=>{
  const newCode = (await fs.readFile('./elevators.js','utf-8')).match(/.*(\{[\w\W]*\})/)[1];
  const $ = cheerio.load(await fs.readFile('./refs/originalproj/index.html','utf-8'));
  const CHALLENGE_NO = require('./elevators');

  $('#default-elev-implementation').text(newCode);
  $('body').append(`
<script>
  if(!window.location.hash){
    window.location.hash = "challenge=${CHALLENGE_NO}"
  }
  setTimeout(() => {
    $('#button_apply').trigger('click');
  }, 500);
</script>
  `);
  
  await fs.writeFile('./refs/originalproj/project.html', $.html());
  await open(__dirname + '/refs/originalproj/project.html');
})();
