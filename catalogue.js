const areas = {
  STEM: ['atom','stem','Build, code and investigate'],
  Business: ['briefcase-business','business','Experiment with ideas and markets'],
  Arts: ['palette','arts','Make and share creative work'],
  Law: ['scale','law','Explore arguments and public policy'],
  'Social Impact': ['heart-handshake','social','Help improve your community'],
  Architecture: ['landmark','architecture','Design better spaces']
};

const entries = [
  ['stem-lab','School Timetable Lab','STEM','Project','Online','Free','weekend','Coding, logic','Build a schedule tool that flags room or time conflicts.','Sketch two examples of timetable clashes. Then write rules that can spot them.'],
  ['market','Student Microbusiness','Business','Project','Local','Low cost','weeks','Budgeting, research','Design a small school-approved business and work out whether it can break even.','Interview five classmates about something they wish they could buy at school. Use their feedback to draft a budget.'],
  ['exhibition','Youth Art Exhibition','Arts','Project','Local','Low cost','weeks','Curation, visual design','Curate a small exhibition and create a story around a theme that matters to you.','Choose a theme, ask a teacher about display space and invite three peers to submit work.'],
  ['access','Neighborhood Accessibility Audit','Social Impact','Service','Local','Free','weekend','Observation, teamwork','Map barriers people encounter in a public space and propose improvements.','Choose a familiar route with a trusted adult or school group. Record barriers with observations and sketches.'],
  ['redesign','Sustainable School Redesign','Architecture','Project','Local','Free','weeks','Sketching, sustainability','Redesign one school space to improve shade, airflow or everyday use.','Pick a space and observe how people use it at two different times. Sketch three improvements.'],
  ['trial','School Mock Trial','Law','Club','Local','Free','weeks','Debate, writing','Work in teams to analyze a fictional case and practice making evidence-based arguments.','Ask a teacher to supervise. Give peers a short fictional case and assign roles.'],
  ['wharton','Wharton Investment Competition','Business','Competition','Online','Free','weeks','Research, teamwork','Work with a teacher and teammates to design an investment strategy in a simulated market.','Read the organizer’s rules and ask a teacher whether they can advise your team.','https://globalyouth.wharton.upenn.edu/competitions/investment-competition/'],
  ['dfc','I CAN School Challenge','Social Impact','Competition','Local','Check organizer','weeks','Design thinking, teamwork','Identify a local issue, plan a practical response and document what changes.','Ask your school about participating and read the organizer’s current challenge guidance.','https://www.designforchangeindia.com/i-can-school-challenge'],
  ['bus','Accessible Bus Stop Design','Architecture','Project','Local','Free','weekend','Drawing, accessibility','Sketch a bus stop that offers shade, seating and room for wheelchair users.','Start with a sketch of an existing stop and use your observations to improve the layout.'],
  ['model','Build a Courtyard Model','Architecture','Project','Local','Low cost','weeks','Model making, spatial design','Make a scale model of a courtyard for different groups of students.','Pick a scale, draw a top view and build the first version with reused card.'],
  ['kiosk','Pop-up Kiosk Design','Architecture','Project','Local','Low cost','weeks','Budgeting, sketching','Plan a small school-event kiosk with an efficient footprint and a realistic materials budget.','Sketch the queue and counter layout. Estimate the cost of three build materials.'],
  ['price','Pricing Experiment','Business','Project','Online','Free','weekend','Spreadsheets, research','Compare two pricing models for a school event or student product.','Create a spreadsheet that shows how costs and revenue change at different attendance levels.'],
  ['pitch','School Enterprise Pitch','Business','Club','Local','Free','weeks','Pitching, teamwork','Form a small team and pitch a plan to solve a real school problem sustainably.','Write a one-minute pitch and ask a teacher and classmates to give feedback.'],
  ['heat','Campus Heat Map','STEM','Project','Local','Low cost','weeks','Data, measurement','Measure how surface materials and shade affect temperatures around campus.','Ask for school approval, then pick comparable sunny and shaded sites and plan how to sample them.'],
  ['nature','Local Biodiversity Log','STEM','Project','Local','Free','weeks','Field notes, data','Track plants and insects in a small area and look for patterns across visits.','Choose an approved observation spot and record the same kinds of details each time.'],
  ['robot','School Robotics Sprint','STEM','Club','Local','Low cost','weeks','Electronics, prototyping','Build and test a simple robot that follows a route or moves an object.','Ask your school lab which parts are available. Prototype one movement before adding sensors.'],
  ['zine','Illustrated Digital Zine','Arts','Project','Online','Free','weekend','Illustration, writing','Create a short illustrated publication about an issue students care about.','Design a four-page outline and make the first spread with a tool you already know.'],
  ['film','One-Minute Documentary','Arts','Project','Local','Free','weekend','Storyboarding, editing','Tell a story about a school space or community tradition in one minute.','Write a five-shot storyboard. Ask for permission before filming identifiable people.'],
  ['poster','Public Awareness Poster Set','Arts','Service','Online','Free','weekend','Visual hierarchy, writing','Design three posters that show classmates a practical way to help with a local issue.','Pick one action and test whether classmates can identify it from a paper sketch.'],
  ['policy','School Policy Debate','Law','Club','Local','Free','weeks','Debate, policy research','Research both sides of a school policy and write a balanced brief.','Choose a proposal with a teacher and collect evidence for two opposing viewpoints.'],
  ['rights','Student Rights Explainer','Law','Project','Online','Free','weekend','Research, plain-language writing','Create a classroom resource explaining one school rule or civic topic with sources.','Choose one narrow question, find official information and have a teacher check your draft.'],
  ['civic','Youth Council Simulation','Law','Club','Local','Free','weeks','Public speaking, negotiation','Simulate a local council meeting and practice drafting proposals and compromises.','Pick a fictional scenario and give each group a different stakeholder perspective.'],
  ['tutor','Peer Tutoring Circle','Social Impact','Service','Local','Free','weeks','Teaching, communication','Help younger students develop confidence in a subject through short group sessions.','Ask a teacher to supervise and identify one topic for a short first session.'],
  ['reuse','School Reuse Drive','Social Impact','Service','Local','Free','weeks','Coordination, measurement','Organize a teacher-approved swap for books or supplies and track what gets reused.','Choose one category and estimate how many students could benefit from a pilot.']
].map(([id,title,area,type,format,cost,time,skills,description,step,url]) => ({id,title,area,type,format,cost,time,skills,description,step,url,grade:'Grades 9–12'}));

const universities = [
  {name:'MIT', place:'Cambridge, United States', focus:'Engineering, science and design', url:'https://mitadmissions.org/'},
  {name:'UCL', place:'London, United Kingdom', focus:'Architecture, social sciences and more', url:'https://www.ucl.ac.uk/study/prospective-students/undergraduate'},
  {name:'University of Toronto', place:'Toronto, Canada', focus:'Business, science and humanities', url:'https://future.utoronto.ca/'},
  {name:'Ashoka University', place:'Sonipat, India', focus:'Liberal arts, economics and sciences', url:'https://www.ashoka.edu.in/admissions/undergraduate-students/'}
];
