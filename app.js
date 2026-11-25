const shell = document.querySelector('#shell');
const detail = document.querySelector('#detail');
const announcer = document.querySelector('#announce');
const cloudError = document.querySelector('#cloud-error');
const defaultStore = { name:'', grade:'', interests:[], format:'', time:'', goal:'', quiz:false, saved:[], plan:{}, universities:[] };
let savedState = {};
try { savedState = JSON.parse(localStorage.getItem('pathly') || '{}') || {}; } catch {}
const store = { ...defaultStore, ...savedState };
let guestActivities = { saved: store.saved, plan: store.plan };
let signedInUser = null;
let cloudState = pathlyCloud.canConnect ? 'starting' : 'local';
let accountMessage = '';
let accountMode = 'signin';
let accountEmail = '';
let accountBusy = false;
let cloudGeneration = 0;
const pendingActivityWrites = new Set();
let quiz = { step:1, choices:[...store.interests] };
let messages = [];
let returnFocus = null;
let matchedCategory = '';
const homeOrder = ['stem-lab','market','exhibition','access'];
const actionStatuses = ['To explore','In progress','Completed'];
const navItems = [['home','Home','house'],['explore','Explore','search'],['plan','My Plan','calendar-days'],['universities','Universities','landmark'],['assistant','Assistant','message-square'],['profile','Profile','user-round']];
const previewPictures = new Set(['STEM','Business','Arts','Social Impact']);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const icon = name => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconShapes[name] || '')+'</svg>';
const route = () => {
  const [page, query=''] = location.hash.slice(1).split('?');
  return { page:page || 'home', params:new URLSearchParams(query) };
};
const href = (page, params={}) => '#'+page+(Object.keys(params).length ? '?'+new URLSearchParams(params) : '');
const link = (page, label, symbol, css='text-link', params={}) => '<a class="'+css+'" href="'+escapeHtml(href(page,params))+'">'+label+(symbol ? icon(symbol) : '')+'</a>';
const pageIntro = (title, description) => '<div class="page-intro"><h1>'+title+'</h1><p>'+description+'</p></div>';
const brand = extra => '<a href="#home" class="logo '+extra+'" aria-label="Pathly home"><span class="leaves" aria-hidden="true"></span>Pathly</a>';
const timeLabel = time => time === 'weekend' ? 'One weekend' : 'Several weeks';

function persist(message) {
  try {
    localStorage.setItem('pathly',JSON.stringify({ ...store, ...guestActivities }));
  } catch {
    message = 'Changes are available for this session. This browser blocked local storage.';
  }
  if (message) announcer.textContent = message;
}

function showCloudError(message = '') {
  cloudError.textContent = message;
  cloudError.hidden = !message;
  const dialogNotice = detail.querySelector('.cloud-dialog-error');
  if (dialogNotice) {
    dialogNotice.textContent = message;
    dialogNotice.hidden = !message;
  }
}

function activitiesLocked() {
  return cloudState === 'starting' || Boolean(signedInUser && cloudState !== 'ready');
}

function refreshAccountView() {
  if (detail.open) detail.close();
  render();
}

async function loadCloudActivities() {
  const user = signedInUser;
  if (!user) return;
  const generation = ++cloudGeneration;
  cloudState = 'loading';
  refreshAccountView();
  try {
    const { data, error } = await pathlyCloud.load(user.id);
    if (error) throw error;
    if (generation !== cloudGeneration) return;
    store.saved = data.filter(row => row.kind === 'bookmark').map(row => row.activity_id);
    store.plan = Object.fromEntries(data.filter(row => row.kind === 'plan').map(row => [row.activity_id, row.status]));
    cloudState = 'ready';
    showCloudError();
  } catch {
    if (generation !== cloudGeneration) return;
    cloudState = 'failed';
    showCloudError('Could not load your saved activities. Check the connection and try again.');
  }
  refreshAccountView();
}

function useAccount(user) {
  if (cloudState !== 'starting' && signedInUser?.id === user?.id) return;
  ++cloudGeneration;
  pendingActivityWrites.clear();
  showCloudError();
  signedInUser = user;
  if (user) {
    accountEmail = '';
    accountMode = 'signin';
    store.saved = [];
    store.plan = {};
    accountMessage = '';
    void loadCloudActivities();
  } else {
    Object.assign(store, guestActivities);
    cloudState = 'guest';
    refreshAccountView();
  }
}

function activityControls(id, kind) {
  const selector = kind === 'bookmark'
    ? '[data-action="bookmark"]'
    : '[data-action="add-plan"], [data-action="remove-plan"], [data-status]';
  return [...document.querySelectorAll(selector)].filter(control =>
    control.dataset.status === id || control.dataset.value === id);
}

async function changeActivity(id, kind, value, message) {
  const operation = kind + ':' + id;
  if (activitiesLocked() || pendingActivityWrites.has(operation)) return false;
  const user = signedInUser;
  const generation = cloudGeneration;
  if (user) {
    pendingActivityWrites.add(operation);
    activityControls(id, kind).forEach(control => { control.disabled = true; });
    try {
      const { error } = await pathlyCloud.change(user.id, id, kind, value);
      if (generation !== cloudGeneration) return false;
      if (error) throw error;
      showCloudError();
    } catch {
      if (generation === cloudGeneration) {
        for (const control of activityControls(id, kind)) {
          if (control.dataset.status) control.value = store.plan[id];
        }
        showCloudError('Could not save this change. Please try again.');
      }
      return false;
    } finally {
      if (generation === cloudGeneration) {
        pendingActivityWrites.delete(operation);
        for (const control of activityControls(id, kind)) {
          control.disabled = control.dataset.action === 'add-plan' && Object.hasOwn(store.plan, id);
        }
      }
    }
  }

  if (kind === 'bookmark') {
    store.saved = value ? [...store.saved, id] : store.saved.filter(item => item !== id);
  } else if (value === null) {
    delete store.plan[id];
  } else {
    store.plan[id] = value;
    for (const control of activityControls(id, kind)) {
      if (control.dataset.status) control.value = value;
    }
  }

  if (user) {
    announcer.textContent = message;
  } else {
    guestActivities = { saved: store.saved, plan: store.plan };
    persist(message);
  }
  return true;
}

async function importGuestActivities() {
  if (!signedInUser || activitiesLocked() || pendingActivityWrites.size) return;
  const known = new Set(entries.map(activity => activity.id));
  const saved = [...new Set(guestActivities.saved.filter(id => known.has(id)))];
  const plan = Object.fromEntries(Object.entries(guestActivities.plan)
    .filter(([id, status]) => known.has(id) && actionStatuses.includes(status)));
  if (!saved.length && !Object.keys(plan).length) return;

  const user = signedInUser;
  const generation = cloudGeneration;
  cloudState = 'importing';
  refreshAccountView();
  try {
    const { error } = await pathlyCloud.importActivities(user.id, saved, plan);
    if (generation !== cloudGeneration) return;
    if (error) throw error;
    await loadCloudActivities();
    if (cloudState === 'ready' && signedInUser?.id === user.id) {
      announcer.textContent = 'Activities copied from this browser.';
    }
  } catch {
    if (generation !== cloudGeneration) return;
    cloudState = 'ready';
    showCloudError('Could not copy activities from this browser. Please try again.');
    refreshAccountView();
  }
}

function authErrorMessage(error) {
  const messages = {
    invalid_credentials: 'That email and password didn’t match a Pathly account. New here? Choose Create account and set a password for Pathly.',
    email_not_confirmed: 'Open the confirmation email from Pathly’s Supabase project, then sign in. Check your spam folder too.',
    signup_disabled: 'Account creation is turned off. The project owner can enable “Allow new users to sign up” in Supabase Authentication.',
    email_provider_disabled: 'Email sign-in is turned off. The project owner can enable the Email provider in Supabase Authentication.',
    email_address_not_authorized: 'This project’s email service only sends to team addresses. Use a project team email to test, or ask the owner to configure custom SMTP.',
    over_email_send_rate_limit: 'The project has reached its email sending limit. Check for an earlier confirmation email or try again later.',
    over_request_rate_limit: 'Too many attempts. Wait a little before trying again.'
  };
  return messages[error.code] || error.message || 'Unable to contact Supabase. Check your connection and try again.';
}

async function submitAccount(form, data) {
  if (accountBusy) return;
  accountBusy = true;
  accountEmail = data.email.trim();
  const feedback = form.querySelector('[role="status"]');
  feedback.textContent = accountMode === 'signup' ? 'Creating your account…' : 'Signing in…';
  form.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    const { data: result, error } = await pathlyCloud.signIn(accountMode, accountEmail, data.password);
    if (error) throw error;
    if (result.session?.user) {
      useAccount(result.session.user);
    } else {
      accountMode = 'signin';
      accountMessage = 'Check your inbox and spam folder for a confirmation link. If you already confirmed this address, sign in with your Pathly password.';
      render();
    }
  } catch (error) {
    accountMessage = authErrorMessage(error);
    feedback.textContent = accountMessage;
  } finally {
    accountBusy = false;
    form.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}

async function signOutOfAccount(button) {
  button.disabled = true;
  try {
    const { error } = await pathlyCloud.signOut();
    if (error) throw error;
    useAccount(null);
  } catch {
    showCloudError('Could not sign out. Please try again.');
    button.disabled = false;
  }
}

function navMarkup(items, page) {
  return items.map(([id,label,symbol]) => '<a href="#'+id+'"'+(page===id?' aria-current="page"':'')+'>'+icon(symbol)+'<span>'+label+'</span></a>').join('');
}

function areaChips() {
  return Object.entries(areas).map(([name,[,color]])=>link('explore',name,'','chip '+color,{area:name})).join('');
}

function areaTiles(scope, active, descriptions=false) {
  return Object.entries(areas).map(([name,[symbol,color,description]])=>'<button type="button" class="tile '+color+'" data-action="'+scope+'" data-value="'+name+'" aria-pressed="'+active.includes(name)+'">'+icon(symbol)+name+(descriptions?'<small>'+description+'</small>':'')+'</button>').join('');
}

function actionButton(action, value, label, symbol, pressed) {
  const kind = action === 'bookmark' ? 'bookmark' : 'plan';
  const disabled = ['bookmark', 'remove-plan'].includes(action) &&
    (activitiesLocked() || pendingActivityWrites.has(kind + ':' + value));
  return '<button type="button" class="icon-button" data-action="'+action+'" data-value="'+value+'" aria-label="'+escapeHtml(label)+'"'+(pressed===undefined?'':' aria-pressed="'+pressed+'"')+(disabled?' disabled':'')+'>'+icon(symbol)+'</button>';
}

function card(activity, direct=false) {
  const {id,title,area,grade,format,description} = activity;
  const [symbol,color] = areas[area];
  const photo = previewPictures.has(area) ? '<img loading="lazy" src="assets/'+color+'.webp" alt="">' : icon(symbol);
  return '<article class="card"><div class="card-picture '+color+'">'+photo+'</div>'+
    actionButton('bookmark',id,'Save '+title,'bookmark',store.saved.includes(id))+
    '<div class="card-body"><span class="tag '+color+'">'+area+'</span>'+
    '<h3><button type="button" class="card-title" data-action="activity" data-value="'+id+'">'+title+'</button></h3>'+
    '<p>'+description+'</p><div class="meta"><span>'+icon('graduation-cap')+grade+'</span><span>'+icon(format==='Online'?'globe':'map-pin')+format+'</span>'+
    (direct?'<span>'+icon('check')+'Interest match</span>':'')+'</div></div></article>';
}

function rank(list) {
  return [...list].sort((first, second) => score(second)-score(first));
}

function score(activity) {
  const goalTerms = store.goal.toLowerCase().split(/[^a-z]+/).filter(term=>term.length>3);
  const activityText = (activity.title+' '+activity.skills+' '+activity.description).toLowerCase();
  return Number(store.interests.includes(activity.area))*10
    + Number(store.format===activity.format)*3
    + Number(store.time===activity.time)*2
    + Math.min(goalTerms.filter(term=>activityText.includes(term)).length,3);
}

function homePage() {
  const picks = store.interests.length ? rank(entries).slice(0,4) : homeOrder.map(id=>entries.find(activity=>activity.id===id));
  return '<section class="hero"><div class="hero-copy"><h1>Hi '+escapeHtml(store.name||'there')+'! 👋</h1>'+
    '<p>Find new opportunities that match your interests.</p><div class="chips">'+areaChips()+'</div></div>'+
    '<img class="hero-image" src="assets/hero.webp" alt=""></section>'+
    '<section><div class="section-heading"><h2>'+(store.quiz?'Your personalized recommendations':'Recommended for you')+'</h2>'+
    link('explore','See all','arrow-right','text-link',store.quiz?{mode:'matches'}:{})+'</div>'+
    '<div class="cards">'+picks.map(activity=>card(activity, store.interests.includes(activity.area))).join('')+'</div></section>'+
    '<div class="home-lower"><section class="panel"><div class="panel-top"><span class="switch-icon">'+icon('sparkles')+'</span>'+
    '<div><h2>Chat with Pathly</h2><p>Ask for ideas or get help choosing an activity.</p></div></div>'+
    '<form class="inline-form" data-form="assistant"><input aria-label="Ask Pathly" name="message" maxlength="300" placeholder="Type your message…" required>'+
    '<button class="primary" aria-label="Send message">'+icon('send')+'</button></form></section>'+
    '<section class="panel"><h2>What are your interests?</h2><p>Select up to five areas for your recommendations.</p>'+
    '<div class="tile-grid">'+areaTiles('home-interest',store.interests)+'</div>'+
    link('quiz',store.quiz?'Edit your quiz':'Take the interest quiz','arrow-right','text-link')+'</section></div>';
}

function selectOptions(values, value, placeholder) {
  return '<option value="">'+placeholder+'</option>'+values.map(item=>{
    const [key,label] = Array.isArray(item)?item:[item,item];
    return '<option value="'+escapeHtml(key)+'"'+(key===value?' selected':'')+'>'+label+'</option>';
  }).join('');
}

function explorePage(params) {
  const matches = params.get('mode') === 'matches';
  return pageIntro(matches?'Your recommendations':'Explore opportunities',
    matches?'Activities are ranked using your interests and preferences. Related ideas help you explore further.':'Discover projects, clubs, competitions and ways to help your community.')+
    '<form class="filters" id="filters">'+
    '<label class="field-label wide">Search<input class="field" type="search" name="q" placeholder="Try design or coding" value="'+escapeHtml(params.get('q'))+'"></label>'+
    '<label class="field-label">Category<select name="area">'+selectOptions(Object.keys(areas),params.get('area'),'All categories')+'</select></label>'+
    '<label class="field-label">Activity type<select name="type">'+selectOptions(['Project','Service','Club','Competition'],'','All types')+'</select></label>'+
    '<label class="field-label">Format<select name="format">'+selectOptions(['Online','Local'],'','Any format')+'</select></label>'+
    '<label class="field-label">Cost<select name="cost">'+selectOptions(['Free','Low cost','Check organizer'],'','Any cost')+'</select></label>'+
    '<label class="field-label">Commitment<select name="time">'+selectOptions([['weekend','One weekend'],['weeks','Several weeks']],'','Any commitment')+'</select></label></form>'+
    '<div class="result-line"><p id="result-count" aria-live="polite"></p>'+
    (matches?link('quiz','Edit quiz','chevron-right'):link('quiz','Get recommendations','chevron-right'))+'</div>'+
    '<div id="results"></div>';
}

function refreshResults() {
  const form = document.querySelector('#filters');
  if (!form) return;
  const filters = Object.fromEntries(new FormData(form));
  const terms = filters.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = entries.filter(activity=>{
    const text = [activity.title,activity.description,activity.area,activity.type,activity.skills].join(' ').toLowerCase();
    return terms.every(term=>text.includes(term)) &&
      ['area','type','format','cost','time'].every(key=>!filters[key]||activity[key]===filters[key]);
  });
  const matches = route().params.get('mode')==='matches';
  const results = matches ? rank(filtered) : filtered;
  document.querySelector('#result-count').textContent = results.length+' '+(results.length===1?'activity':'activities');
  document.querySelector('#results').innerHTML = results.length ?
    '<div class="cards">'+results.map(activity=>card(activity,matches && store.interests.includes(activity.area))).join('')+'</div>' :
    '<div class="panel empty"><h2>No activities found</h2><p>Try a different keyword or clear your filters.</p><button class="primary" data-action="clear-filters">Clear filters</button></div>';
}

function quizPage() {
  const first = quiz.step===1;
  return pageIntro('Find your interests','Answer two quick questions to get suggestions you can explore.')+
    '<section class="panel quiz"><div class="quiz-progress" aria-label="Step '+quiz.step+' of 2"><span class="current"></span><span'+(first?'':' class="current"')+'></span></div>'+
    (first?'<h2>Which areas interest you?</h2><p>Select up to five, or continue to explore all areas.</p><div class="tile-grid">'+
      areaTiles('quiz-interest',quiz.choices,true)+'</div><p id="selection-count">'+quiz.choices.length+' of 5 selected</p>'+
      '<div class="quiz-actions"><button class="primary" data-action="quiz-next">Continue '+icon('arrow-right')+'</button>'+
      '<button class="secondary" data-action="quiz-skip">I’m still exploring</button></div>':
      '<h2>What fits your schedule?</h2><p>You can skip any of these preferences.</p><form data-form="quiz">'+
      '<label class="field-label">Preferred format<select name="format">'+selectOptions(['Online','Local'],quiz.format ?? store.format,'No preference')+'</select></label>'+
      '<label class="field-label">Time commitment<select name="time">'+selectOptions([['weekend','One weekend'],['weeks','Several weeks']],quiz.time ?? store.time,'No preference')+'</select></label>'+
      '<label class="field-label">Skill or goal <input class="field" name="goal" maxlength="100" placeholder="E.g. sketching or public speaking" value="'+escapeHtml(quiz.goal ?? store.goal)+'"></label>'+
      '<div class="quiz-actions"><button type="button" class="secondary" data-action="quiz-back">'+icon('arrow-left')+'Back</button>'+
      '<button class="primary">See my recommendations '+icon('arrow-right')+'</button></div></form>')+'</section>';
}

function planPage() {
  const saved = entries.filter(activity=>store.saved.includes(activity.id));
  const planned = entries.filter(activity=>Object.hasOwn(store.plan,activity.id));
  const trackedUniversities = universities.filter(university=>store.universities.includes(university.name));
  return pageIntro('My Plan','Revisit saved ideas and decide what to try next.')+planAccountStatus()+
    '<section class="plan-group"><div class="section-heading"><h2>Saved activities</h2>'+link('explore','Explore activities','arrow-right')+'</div>'+
    (saved.length?'<div class="cards">'+saved.map(activity=>card(activity)).join('')+'</div>':
      '<div class="panel empty"><h3>No saved activities yet</h3><p>Bookmark an activity to see it here.</p></div>')+'</section>'+
    '<section class="plan-group"><div class="section-heading"><h2>Activity tracker</h2></div>'+
    (planned.length?'<div class="plan-list">'+planned.map(activity=>'<article class="panel plan-row"><div><h3>'+
      '<button type="button" class="card-title" data-action="activity" data-value="'+activity.id+'">'+activity.title+'</button></h3><p>'+activity.area+'</p></div>'+
      '<div class="actions"><select data-status="'+activity.id+'" aria-label="Status for '+activity.title+'"'+
      (activitiesLocked() || pendingActivityWrites.has('plan:'+activity.id)?' disabled':'')+'>'+
      actionStatuses.map(status=>'<option'+(status===store.plan[activity.id]?' selected':'')+'>'+status+'</option>').join('')+'</select>'+
      actionButton('remove-plan',activity.id,'Remove '+activity.title,'x')+'</div></article>').join('')+'</div>':
      '<div class="panel empty"><h3>No activities in your tracker</h3><p>Open an activity and choose Add to my plan.</p></div>')+'</section>'+
    (trackedUniversities.length?'<section class="plan-group"><div class="section-heading"><h2>Saved universities</h2></div><div class="cards universities">'+trackedUniversities.map(universityCard).join('')+'</div></section>':'');
}

function universityCard(university) {
  const {name,place,focus,url} = university;
  return '<article class="panel"><h3>'+name+'</h3><p>'+place+'</p><p>'+focus+'</p>'+
    actionButton('university',universities.indexOf(university),'Save '+name,'bookmark',store.universities.includes(name))+
    '<a class="text-link" target="_blank" rel="noopener noreferrer" href="'+url+'">Official admissions '+icon('external-link')+'</a></article>';
}

function universityPage() {
  return pageIntro('Universities','Compare courses, entry requirements, costs and application timelines on official admissions pages.')+
    '<div class="cards universities">'+universities.map(universityCard).join('')+'</div>';
}

function assistantPage() {
  const prompts = ['I like Business and Architecture','Suggest online STEM activities','What can I try this weekend?'];
  return pageIntro('Chat with Pathly','This prototype assistant suggests ideas from the Pathly activity catalogue.')+
    '<section class="panel chat"><div class="messages" aria-live="polite"><div class="bubble">Tell me an interest, how much time you have, or whether you want an online activity.</div>'+
    messages.map(message=>'<div class="bubble '+message.role+'"><span class="sr">'+(message.role==='user'?'You: ':'Pathly: ')+'</span>'+escapeHtml(message.text)+'</div>').join('')+
    '</div><div class="chips">'+prompts.map(prompt=>'<button class="chip" data-action="prompt" data-value="'+prompt+'">'+prompt+'</button>').join('')+
    '</div><form class="inline-form" data-form="assistant"><input aria-label="Message Pathly" name="message" maxlength="300" placeholder="Type your message…" required>'+
    '<button class="primary" aria-label="Send message">'+icon('send')+'</button></form>'+
    (matchedCategory?'<div class="panel-foot">'+link('explore','Browse '+matchedCategory,'arrow-right','text-link',{area:matchedCategory})+'</div>':'')+'</section>';
}

function planAccountStatus() {
  let content = '<p role="status">Loading saved activities…</p>';
  if (cloudState === 'ready') content = '<p>Your bookmarks and tracker are saved to your Pathly account.</p>';
  if (cloudState === 'failed') content = '<p>Your account activities could not load.</p><button class="secondary" data-action="retry-cloud">Try again</button>';
  return '<section class="panel account-note">'+content+'</section>';
}

function accountPanel() {
  const canImport = guestActivities.saved.length || Object.keys(guestActivities.plan).length;
  return '<section class="panel profile account-panel"><h2>Pathly account</h2><p>Signed in as <strong>'+escapeHtml(signedInUser.email)+'</strong>.</p>'+
    planAccountStatus()+'<div class="quiz-actions">'+
    (canImport && cloudState === 'ready'?'<button class="secondary" data-action="import-activities">Copy activities from this browser</button>':'')+
    '<button class="secondary" data-action="sign-out">Sign out</button></div></section>';
}

function accountStartPage() {
  const signup = accountMode === 'signup';
  const title = signup ? 'Create your Pathly account' : 'Sign in to Pathly';
  let content;
  if (cloudState === 'guest') {
    content = '<form data-form="account"><label class="field-label">Email<input class="field" name="email" type="email" autocomplete="email" value="'+escapeHtml(accountEmail)+'" required></label>'+
      '<label class="field-label">Pathly password<input class="field" name="password" type="password" autocomplete="'+(signup ? 'new-password' : 'current-password')+'" required></label>'+
      '<div class="quiz-actions"><button class="primary" type="submit">'+(signup ? 'Create account' : 'Sign in')+'</button>'+
      '<button class="secondary" type="button" data-action="switch-auth">'+(signup ? 'Back to sign in' : 'Create account')+'</button></div>'+
      '<p role="status">'+escapeHtml(accountMessage)+'</p></form>';
  } else {
    let message = accountMessage || 'Connecting to Supabase…';
    if (!pathlyCloud.configured) message = 'Open public/supabase-config.js in VS Code, enter your Project URL and publishable key, save, then press F5.';
    else if (!pathlyCloud.canConnect) message = 'Start Pathly with F5 in VS Code and open http://127.0.0.1:3000/ to sign in.';
    content = '<p role="status">'+escapeHtml(message)+'</p>';
  }
  document.title = 'Pathly · '+title;
  return '<main id="main" class="account-start" tabindex="-1"><section class="profile panel">'+brand('')+
    '<h1>'+title+'</h1><p>'+(signup ? 'Choose a password to save your activities across devices.' : 'Access your saved activities and pick up where you left off.')+'</p>'+content+'</section></main>';
}

function profilePage(page) {
  if (page==='settings') return pageIntro('Settings','Your profile and quiz preferences stay in this browser. Account sign-in syncs activity bookmarks and tracker statuses.')+
    '<section class="panel profile"><h2>Personalization</h2><p>Update your nickname or grade, or adjust your activity preferences.</p>'+
    '<div class="quiz-actions">'+link('profile','Open profile','user-round','secondary')+link('quiz','Edit interest quiz','arrow-right','primary')+'</div></section>';
  return pageIntro('Profile','Manage your Pathly account and personalize this device.')+accountPanel()+
    '<form class="panel profile" data-form="profile"><h2>Your details</h2><label class="field-label">Nickname<input class="field" name="name" maxlength="28" value="'+escapeHtml(store.name)+'"></label>'+
    '<label class="field-label">Grade<select name="grade">'+selectOptions(['Grade 9','Grade 10','Grade 11','Grade 12'],store.grade,'Select a grade')+'</select></label>'+
    '<div class="quiz-actions"><button class="primary">Save profile</button>'+link('quiz','Edit interests','chevron-right','secondary')+'</div></form>';
}

function render() {
  if (!signedInUser) {
    shell.innerHTML = accountStartPage();
    return;
  }
  const {page,params}=route();
  const pages = { home:homePage, explore:()=>explorePage(params), quiz:quizPage, plan:planPage, universities:universityPage, assistant:assistantPage, profile:()=>profilePage(page), settings:()=>profilePage(page) };
  document.title = 'Pathly · '+({home:'Home',explore:'Explore',quiz:'Interest quiz',plan:'My Plan',universities:'Universities',assistant:'Assistant',profile:'Profile',settings:'Settings'}[page]||'Home');
  shell.innerHTML = '<div class="shell"><aside class="sidebar">'+brand('')+
    '<nav aria-label="Main navigation">'+navMarkup(navItems,page)+'</nav><div class="sidebar-foot"><nav aria-label="Preferences">'+navMarkup([['settings','Settings','settings']],page)+'</nav></div></aside>'+
    '<main id="main" class="workspace" tabindex="-1"><header class="header">'+brand('mobile-logo')+
    '<form data-form="search" class="searchbar">'+icon('search')+'<input type="search" name="q" aria-label="Search opportunities" placeholder="Search for opportunities, skills or keywords…"></form>'+
    '<a class="profile-button" href="#profile" aria-label="Profile">'+icon('user-round')+'</a><a class="profile-button mobile-logo" href="#settings" aria-label="Settings">'+icon('settings')+'</a></header>'+
    (Object.hasOwn(pages,page)?pages[page]:homePage)()+'</main><nav class="mobile-nav" aria-label="Mobile navigation">'+navMarkup(navItems.slice(0,5),page)+'</nav></div>';
  refreshResults();
}

function updateActionState(action,value,pressed) {
  document.querySelectorAll('[data-action="'+action+'"]').forEach(button=>{
    if (button.dataset.value===value) button.setAttribute('aria-pressed',pressed);
  });
}

function toggleInterest(list,area) {
  if (list.includes(area)) return list.filter(value=>value!==area);
  if (list.length===5) {
    announcer.textContent = 'You can select up to five interests.';
    return list;
  }
  return [...list,area];
}

function showActivity(activity) {
  const {id,area,title,description,cost,grade,format,time,skills,step,url,type}=activity;
  const tracked = Object.hasOwn(store.plan,id);
  detail.setAttribute('aria-labelledby','activity-title');
  detail.innerHTML = '<button class="icon-button close" data-action="close-detail" aria-label="Close">'+icon('x')+'</button>'+
    '<span class="tag '+areas[area][1]+'">'+area+'</span><h2 id="activity-title">'+title+'</h2><p>'+description+'</p>'+
    '<div class="meta"><span>'+icon('graduation-cap')+grade+'</span><span>'+icon('map-pin')+format+'</span>'+
    '<span>'+icon('clock')+timeLabel(time)+'</span><span>'+cost+'</span></div>'+
    '<h3>Activity type</h3><p>'+type+(url?' · Organizer-run':' · School or self-directed idea')+'</p>'+
    '<h3>Skills to practice</h3><p>'+skills+'</p><h3>How to get started</h3><p>'+step+'</p>'+
    (url?'<p><a class="text-link" target="_blank" rel="noopener noreferrer" href="'+url+'">Check organizer for current dates and eligibility '+icon('external-link')+'</a></p>':'')+
    '<p class="cloud-dialog-error" role="alert" hidden></p><div class="dialog-actions">'+actionButton('bookmark',id,'Save '+title,'bookmark',store.saved.includes(id))+
    '<button class="primary" data-action="add-plan" data-value="'+id+'"'+(tracked || activitiesLocked() || pendingActivityWrites.has('plan:'+id)?' disabled':'')+'>'+icon(tracked?'check':'plus')+(tracked?'Added to my plan':'Add to my plan')+'</button></div>';
  if (!detail.open) detail.showModal();
}

function sendMessage(text) {
  const message=text.trim().slice(0,300);
  if (!message) return;
  messages.push({role:'user',text:message});
  const lower=message.toLowerCase();
  const aliases = { 'STEM':/stem|coding|science|robot|tech/, 'Business':/business|market|budget|entrepren/, 'Architecture':/architect|building|sketch|spaces/, 'Arts':/\bart|draw|design|film/, 'Law':/\blaw|policy|debate|civic/, 'Social Impact':/social impact|volunteer|service|community/ };
  const named = Object.keys(aliases).filter(area=>aliases[area].test(lower));
  const interests = named.length?named:store.interests;
  matchedCategory = interests[0]||'';
  const online=/online|remote|at home/.test(lower);
  const weekend=/weekend|short|quick/.test(lower);
  const free=/\bfree|no cost/.test(lower);
  const matching = entries.filter(activity=>(!online||activity.format==='Online') && (!weekend||activity.time==='weekend') && (!free||activity.cost==='Free'));
  const relevant = matching.filter(activity=>interests.includes(activity.area));
  const varied = interests.map(area=>relevant.find(activity=>activity.area===area)).filter(Boolean);
  const suggestions = [...new Set([...varied,...relevant,...matching])].slice(0,3);
  messages.push({role:'assistant',text:suggestions.length?
    'Here are '+suggestions.length+' ideas to look at:\n\n'+suggestions.map((activity,index)=>(index+1)+'. '+activity.title+' — '+activity.step).join('\n\n') :
    'I couldn’t find an idea with all those preferences. Try a different time commitment or browse all activities in Explore.'});
  if (route().page==='assistant') {
    render();
    document.querySelector('.chat input').focus();
  } else {
    location.hash='assistant';
  }
}

document.addEventListener('click', async event=>{
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const {action,value}=button.dataset;
  const activity=entries.find(entry=>entry.id===value);
  switch(action) {
    case 'switch-auth': {
      if (accountBusy) break;
      accountEmail = button.form.elements.email.value.trim();
      accountMode = accountMode === 'signup' ? 'signin' : 'signup';
      accountMessage = '';
      render();
      shell.querySelector('[name=email]').focus();
      break;
    }
    case 'bookmark': {
      const removing = store.saved.includes(value);
      const changed = await changeActivity(value, 'bookmark', removing ? null : true, removing ? 'Bookmark removed.' : 'Activity saved.');
      if (!changed) break;
      updateActionState(action, value, !removing);
      if (route().page === 'plan') render();
      break;
    }
    case 'activity': returnFocus=button; showActivity(activity); break;
    case 'close-detail': detail.close(); break;
    case 'add-plan':
      if (await changeActivity(value, 'plan', 'To explore', 'Activity added to My Plan.')) {
        if (route().page === 'plan') render();
        if (detail.open && detail.contains(button)) {
          button.disabled = true;
          button.innerHTML = icon('check')+'Added to my plan';
          detail.querySelector('.close').focus();
        } else {
          const current = detail.querySelector('[data-action="add-plan"]');
          if (current?.dataset.value === value) {
            current.disabled = true;
            current.innerHTML = icon('check')+'Added to my plan';
          }
        }
      }
      break;
    case 'remove-plan':
      if (await changeActivity(value, 'plan', null, 'Activity removed from tracker.') && route().page === 'plan') render();
      break;
    case 'retry-cloud': if (cloudState === 'failed') void loadCloudActivities(); break;
    case 'import-activities': void importGuestActivities(); break;
    case 'sign-out': void signOutOfAccount(button); break;
    case 'university': {
      const name=universities[Number(value)].name;
      const had=store.universities.includes(name);
      store.universities=had?store.universities.filter(item=>item!==name):[...store.universities,name];
      persist(had?'University removed.':'University saved.');
      if (route().page==='plan') render(); else updateActionState(action,value,!had);
      break;
    }
    case 'home-interest':
      store.interests=toggleInterest(store.interests,value);
      persist();
      render();
      document.querySelectorAll('[data-action="home-interest"]').forEach(tile=>{if(tile.dataset.value===value)tile.focus();});
      break;
    case 'quiz-interest':
      quiz.choices=toggleInterest(quiz.choices,value);
      updateActionState(action,value,quiz.choices.includes(value));
      document.querySelector('#selection-count').textContent=quiz.choices.length+' of 5 selected';
      break;
    case 'quiz-skip':
      quiz.choices=[];
      quiz.step=2;
      render();
      document.querySelector('.quiz select').focus();
      break;
    case 'quiz-next': quiz.step=2; render(); document.querySelector('.quiz select').focus(); break;
    case 'quiz-back':
      Object.assign(quiz,Object.fromEntries(new FormData(button.form)));
      quiz.step=1;
      render();
      document.querySelector('.quiz .tile').focus();
      break;
    case 'clear-filters': {
      const form=document.querySelector('#filters');
      for(const field of form.elements) field.value='';
      refreshResults();
      form.q.focus();
      break;
    }
    case 'prompt': sendMessage(value); break;
  }
});

document.addEventListener('input',event=>{if(event.target.form?.id==='filters')refreshResults();});
document.addEventListener('change',event=>{
  const control = event.target;
  if (control.dataset.status) {
    void changeActivity(control.dataset.status, 'plan', control.value, 'Activity status updated.');
  }
});

document.addEventListener('submit',event=>{
  const form=event.target;
  if(!form.dataset.form && form.id!=='filters')return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  switch(form.dataset.form) {
    case 'account': void submitAccount(form, data); break;
    case 'search': {
      const target=href('explore',data.q.trim()?{q:data.q.trim()}:{});
      if(location.hash===target) render(); else location.hash=target;
      break;
    }
    case 'assistant': sendMessage(data.message); break;
    case 'profile':
      store.name=data.name.trim();
      store.grade=data.grade;
      persist('Profile saved.');
      if(!form.querySelector('.form-feedback'))form.insertAdjacentHTML('beforeend','<p class="form-feedback">Profile saved.</p>');
      break;
    case 'quiz':
      Object.assign(store,{...data,interests:[...quiz.choices],quiz:true});
      persist('Recommendations ready.');
      location.hash=href('explore',{mode:'matches'});
      break;
  }
});

detail.addEventListener('close',()=>{
  if(returnFocus?.isConnected)returnFocus.focus(); else document.querySelector('#main')?.focus();
  returnFocus=null;
});
window.addEventListener('hashchange',()=>{
  if(location.hash==='#main') {document.querySelector('#main')?.focus();return;}
  if(detail.open)detail.close();
  if(route().page==='quiz')quiz={step:1,choices:[...store.interests]};
  render();
  window.scrollTo(0,0);
  document.querySelector('#main').focus({preventScroll:true});
});
render();
if (pathlyCloud.canConnect) {
  pathlyCloud.connect(useAccount).catch(error => {
    cloudState = 'local';
    accountMessage = error.message || 'Could not connect to Supabase.';
    refreshAccountView();
  });
}
