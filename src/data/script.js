// ─────────────────────────────────────────────────────────────────────────────
//  THE SCRIPT
//  Every spoken line in the game lives here. The voice bakers in tools/voice
//  export this file to JSONL and render each line with a neural TTS model.
//
//  Inline performance tags (<laugh>, <sigh>, <gasp>, <cough>, <sniff>,
//  <groan>, <whisper>) are understood by the expressive engines (Dia, Maya1,
//  Orpheus, Chatterbox-Turbo) and stripped for engines that can't do them
//  (Kokoro, Web Speech).
// ─────────────────────────────────────────────────────────────────────────────

export const TACTICS = {
  RAPPORT: { label: 'Rapport', color: '#ffb347', icon: '🤝' },
  LOGIC: { label: 'Logic', color: '#6ec6ff', icon: '📊' },
  URGENCY: { label: 'Urgency', color: '#ff5f5f', icon: '⏰' },
  FLATTERY: { label: 'Flattery', color: '#e39bff', icon: '💅' },
  FOMO: { label: 'FOMO', color: '#7dffa1', icon: '😱' },
  HUMOR: { label: 'Humor', color: '#fff275', icon: '🤡' },
};

// Voice casting. `kokoro` is the Kokoro-82M voice id used for the shipped
// pack; `design` is a natural-language voice prompt for voice-design models
// (Maya1, Qwen3-TTS VoiceDesign, Parler) and a casting note for cloning
// models (Chatterbox, IndexTTS2, Dia) that take a reference clip instead.
export const CAST = {
  player: {
    name: 'You (Jordan)',
    kokoro: 'am_michael',
    design: 'Male, early 30s, American, bright slick sales-floor voice, fast talker, smiling while speaking, close-mic headset.',
  },
  chad: {
    name: 'Chad Kowalski, VP of Sales',
    kokoro: 'am_fenrir',
    design: 'Male, 40s, American, loud alpha sales manager, raspy from yelling, gym-bro cadence, speaks like every sentence is a motivational speech.',
  },
  brad: {
    name: 'Brad (desk 4)',
    kokoro: 'am_echo',
    design: 'Male, 20s, American frat bro, smug, loud, celebratory.',
  },
  gerald: {
    name: 'Gerald Pruitt',
    kokoro: 'am_onyx',
    design: 'Male, 60s, Oklahoma accent, gravelly, gruff small-business owner, suspicious but secretly lonely, slow deliberate speech.',
  },
  karen: {
    name: 'Karen Whitfield',
    kokoro: 'af_sarah',
    design: 'Female, 40s, American, crisp corporate procurement manager, clipped efficient delivery, audibly typing, zero patience.',
  },
  tyler: {
    name: 'Tyler "T-Bone" Vance',
    kokoro: 'am_puck',
    design: 'Male, 26, Californian crypto founder, vocal fry, hyped, says "bro", slightly out of breath from a standing desk treadmill.',
  },
  marjorie: {
    name: 'Dr. Marjorie Ellsworth',
    kokoro: 'af_aoede',
    design: 'Female, 70s, American, warm retired dentist, chatty and delighted to have company, meandering, gentle laugh.',
  },
  siobhan: {
    name: "Siobhan O'Malley",
    kokoro: 'bf_alice',
    design: 'Female, 30s, Irish, dry wit, sharp operations executive, amused and skeptical, quick.',
  },
  denise: {
    name: 'Denise (Front Desk)',
    kokoro: 'af_kore',
    design: 'Female, 50s, New Jersey receptionist, flat, bored, seen every trick in the book, chewing gum.',
  },
  walter: {
    name: 'Walter Hargrove III',
    kokoro: 'bm_george',
    design: 'Male, 70s, old-money mid-Atlantic accent, pompous, languid, faintly disgusted by everything, sipping brandy.',
  },
  chip: {
    name: 'Chip Donnelly',
    kokoro: 'am_liam',
    design: 'Male, 30s, American, driving on the highway on speakerphone, distracted, road noise, honks at people.',
  },
  sal: {
    name: 'Sal (wrong number)',
    kokoro: 'am_eric',
    design: 'Male, 50s, Brooklyn, friendly and loud, thinks he called a pizzeria, very hungry.',
  },
  mom: {
    name: 'Mom',
    kokoro: 'af_heart',
    design: 'Female, 60s, American, warm proud mother, a little worried, speaks softly and lovingly.',
  },
  victoria: {
    name: 'Victoria Sterling',
    kokoro: 'bf_emma',
    design: 'Female, 50s, British, ice-cold Fortune 500 CFO, precise, quiet menace, every word costs money.',
  },
};

// ── Player lines ────────────────────────────────────────────────────────────
// Each move has variants. Every variant gets baked three ways: sober,
// drunk (slurred text + slow), and wired (fast). The slurring is authored
// by hand below so TTS engines pronounce it convincingly.
export const PLAYER_LINES = {
  opener: [
    "Hi! This is Jordan from Apex Synergy Solutions. Did I catch you at a bad time? Great, this'll take thirty seconds.",
    "Hey there, Jordan with Apex Synergy. I'll be quick, because I know you're busy, and I respect that.",
  ],
  rapport: [
    "Before I get into it, how's the weather over there? I heard it's gorgeous this time of year.",
    "You sound like somebody who's had a long week. I get it. Honestly, same.",
    "I love your company's logo, by the way. Very strong. Very... round.",
  ],
  discovery: [
    "Let me ask you this. What keeps you up at night, business-wise?",
    "Walk me through your current workflow. Where does it hurt?",
  ],
  logic: [
    "Companies your size save, on average, thirty seven percent in the first quarter with SynergyOS. That's not me talking, that's math.",
    "It's simple. You're spending money on the problem right now. SynergyOS makes the problem cheaper. The ROI basically writes itself.",
  ],
  urgency: [
    "Here's the thing. This pricing expires at five P M today. After that, my hands are tied.",
    "I've only got two onboarding slots left this quarter, and I'd hate for you to miss out.",
  ],
  flattery: [
    "Someone as sharp as you can see where this is going. I can tell you're a visionary.",
    "Honestly? You're the most impressive person I've talked to all day. And I talk to a lot of people.",
  ],
  fomo: [
    "Your biggest competitor signed with us last week. I'm not saying they're going to crush you. I'm just saying they signed.",
    "Everyone in your industry is moving to SynergyOS. I'd hate for you to be the last one on the fax machine.",
  ],
  humor: [
    "You know what they call a salesperson who doesn't follow up? Unemployed. <laugh> Anyway!",
    "I promise I'm not a robot. A robot would have a much better closing rate.",
  ],
  takeaway: [
    "You know what? I'm honestly not sure this is right for you. It's really built for companies that are serious about growth.",
    "Maybe I should call you back when you're ready for the big leagues. No pressure.",
  ],
  close: [
    "So let's do this. I'll send over the paperwork, you sign, and we get you live by Monday. Deal?",
    "I'm going to put you down for the enterprise tier. Sound good? Great. Just need a signature.",
  ],
};

// Hand-authored slurred versions (same index as above).
export const PLAYER_DRUNK = {
  opener: [
    "Hiii! Thish ish Jordan from, uh, Apesh Shynergy. Did I catch you at a bad time? Great. Great. Thirty shecondsh.",
    "Heyyy there. Jordan. Apesh Shynergy. I'll be quick. I'm quick. I respect you. <hiccup>",
  ],
  rapport: [
    "Before I get into it, how'sh the weather? I bet it'sh gorgeoush. You're gorgeoush. Your weather, I mean.",
    "You shound like shomebody who'sh had a long week. Me too, buddy. Me too. <sigh>",
    "I love your logo. It'sh sho round. Sho, sho round.",
  ],
  discovery: [
    "Let me ashk you thish. What keepsh you up at night? For me it'sh... a lot of thingsh.",
    "Walk me through your workflow. Shlowly. Where doesh it hurt? Where doesh it really hurt?",
  ],
  logic: [
    "Companiesh your shize shave, like, thirty sheven... thirty sheventy... a lot. It'sh math, man.",
    "It'sh shimple. You're shpending money. We make it cheaper. The R O I writesh itshelf. Like a book.",
  ],
  urgency: [
    "Thish pricing expiresh at five. Or sheven. Shoon. Very shoon.",
    "I've only got two shlots left. Maybe one. I shpilled shomething on one.",
  ],
  flattery: [
    "Shomeone ash sharp ash you... you're like a knife. A good knife. I love you, man.",
    "You're the mosht impreshive pershon I've talked to all day. Shcrew it, all year.",
  ],
  fomo: [
    "Your competitor shigned with ush. They're gonna crush you. Shorry. Not shorry. Shorry.",
    "Everybody'sh doing it. Everybody. Even my landlord. Don't be the lasht fax machine.",
  ],
  humor: [
    "What do you call a shalesman who doeshn't follow up? <laugh> I forgot. It wash really good though.",
    "I'm not a robot. A robot would be... more shober.",
  ],
  takeaway: [
    "You know what? Thish ishn't for you. It'sh for winnersh. No offensh.",
    "Maybe I call you back when you're in the big leaguesh. Big. Leaguesh.",
  ],
  close: [
    "Sho let'sh do thish. Paperwork. You shign. Monday. Deal? Deal. Deal!",
    "I'm putting you down for the enterprishe tier. Shound good? Shounds great. <hiccup>",
  ],
};

// ── Prospect definitions ────────────────────────────────────────────────────
// weak: damage multipliers per tactic (>1 = weakness, <1 = resistance)
// patience: turns before they hang up. threshold: Interest needed for an
// easy close. value: annual contract value in dollars.
export const PROSPECTS = {
  gerald: {
    speaker: 'gerald',
    name: 'Gerald Pruitt',
    title: 'Owner',
    company: 'Pruitt Plumbing Supply',
    city: 'Tulsa, OK',
    value: 18000,
    patience: 7,
    interest: 15,
    threshold: 70,
    weak: { RAPPORT: 1.8, HUMOR: 1.4, LOGIC: 1.0, URGENCY: 0.6, FLATTERY: 0.5, FOMO: 1.0 },
    notes: ['Family biz since 1971', 'Hates "tech people"', 'Has a bass boat named "Deborah"'],
    lines: {
      intro: ["Pruitt Plumbing. This is Gerald. Make it quick, I got a guy here about a sump pump.", "Yeah, Gerald. Who's this? If this is about my car's extended warranty I swear to God."],
      pos: ["Huh. Well, alright. That ain't the dumbest thing I heard today.", "<laugh> Okay, okay. You got a little personality. I'll give you that.", "Now that's somethin'. My nephew keeps tellin' me we gotta modernize."],
      neu: ["Mm-hm.", "Uh huh. Keep goin'."],
      neg: ["Son, I don't know what half those words mean, and I don't think you do either.", "You sound like one of them YouTube ads.", "<sigh> I'm losin' interest here, partner."],
      slur: ["Boy, are you drunk? It's two in the afternoon. <laugh> Hell, I respect it."],
      wired: ["Slow down, son, you're talkin' like an auctioneer on a bender."],
      silence: ["Hello? You still there? Did I lose ya?"],
      closeYes: ["Alright. Alright, damn it. Send me the papers. But if this thing breaks I'm drivin' to wherever you are."],
      closeNo: ["Whoa, whoa. Nobody said nothin' about signin' anything.", "I ain't signin' a thing I don't understand, and I don't understand a thing."],
      hangup: ["Alright, I'm done. Got a sump pump to deal with.", "Nope. Click."],
    },
    objections: [
      { type: 'LOGIC', counter: 'LOGIC', line: "We been doin' this with a ledger book since nineteen seventy one. Why would I change?" },
      { type: 'TRUST', counter: 'RAPPORT', line: "How'd you get this number anyhow? This is my personal line." },
      { type: 'BUDGET', counter: 'HUMOR', line: "Money's tight. Copper prices are through the roof. I ain't got budget for your cloud whatever." },
    ],
  },

  karen: {
    speaker: 'karen',
    name: 'Karen Whitfield',
    title: 'Director of Procurement',
    company: 'Consolidated Widget Holdings',
    city: 'Columbus, OH',
    value: 64000,
    patience: 6,
    interest: 10,
    threshold: 75,
    weak: { LOGIC: 1.9, FOMO: 1.4, URGENCY: 0.9, RAPPORT: 0.5, HUMOR: 0.4, FLATTERY: 0.7 },
    notes: ['Has an RFP template for buying pens', 'Responds only to numbers', 'Replies-all to everything'],
    lines: {
      intro: ["Procurement, Karen speaking. You have ninety seconds.", "This is Karen. Is this a scheduled call? It is not on my calendar."],
      pos: ["Okay. That's a relevant data point. Go on.", "Interesting. Can you put that in a spreadsheet?", "Fine. That aligns with our Q3 initiatives."],
      neu: ["I'm writing that down.", "Noted."],
      neg: ["That's not a number. I asked for numbers.", "Is there a manager I could speak to? At your company?", "You've now used forty seconds of my ninety."],
      slur: ["Have you been drinking? I'm documenting this call."],
      wired: ["Please enunciate. My transcription software can't keep up with you."],
      silence: ["Hello? Is this a pocket dial? I'm hanging up in three seconds."],
      closeYes: ["Fine. Send me the MSA, the SOC two, and a W nine. Legal will be in touch. Congratulations, I suppose."],
      closeNo: ["Absolutely not. We have a nine-step vendor approval process and you're on step zero.", "I'm going to need three competing quotes first."],
      hangup: ["This call is over. Please remove me from your list.", "I'm going to have to go. Goodbye."],
    },
    objections: [
      { type: 'EMAIL', counter: 'URGENCY', line: "Just send me an email. I'll add it to the queue. The queue is long." },
      { type: 'VENDOR', counter: 'FOMO', line: "We already have a vendor for this. We have a vendor for everything." },
      { type: 'BUDGET', counter: 'LOGIC', line: "This isn't in the budget. The budget was locked in March." },
    ],
  },

  tyler: {
    speaker: 'tyler',
    name: 'Tyler "T-Bone" Vance',
    title: 'Founder & Chief Vibes Officer',
    company: 'BlockChainsaw Labs',
    city: 'Miami, FL',
    value: 120000,
    patience: 5,
    interest: 25,
    threshold: 60,
    weak: { URGENCY: 1.7, FLATTERY: 1.8, FOMO: 2.0, LOGIC: 0.4, RAPPORT: 1.0, HUMOR: 1.1 },
    notes: ['Raised $40M at a $2B valuation', 'Product: TBD', 'Currently on a treadmill desk'],
    lines: {
      intro: ["Yo, T-Bone speaking. Who dis? Is this about the Series B?", "Bro. Bro. Who is this. I'm on a treadmill. Talk fast."],
      pos: ["Bro. BRO. That's actually fire.", "<laugh> Okay you're kind of speaking my language right now.", "Wait, that's actually huge. That's like, web four huge."],
      neu: ["Yeah yeah yeah, go on.", "Totally, totally."],
      neg: ["Bro, that's boomer energy. No offense.", "Mm, sounds kinda centralized, bro.", "I literally zoned out. I'm so sorry. I'm back. What?"],
      slur: ["Bro are you like, lit right now? <laugh> Respect. Hydrate though."],
      wired: ["Yo, you're like, on my frequency right now. I'm vibing. Keep going."],
      silence: ["Hello? Bro? Did you like, rug pull on me?"],
      closeYes: ["Let's GO! Sending it. I'll pay in crypto. Just kidding. Unless?"],
      closeNo: ["Whoa, slow down, I gotta run it by my spiritual advisor.", "Nah bro, my advisor says Mercury's in retrograde."],
      hangup: ["Bro I gotta go, my ice bath is ready.", "Aight I'm out, peace."],
    },
    objections: [
      { type: 'DECISION', counter: 'FLATTERY', line: "Honestly I'd have to run it by my co-founder. He's in Bali. Finding himself." },
      { type: 'VENDOR', counter: 'FOMO', line: "We kinda built our own thing for this. It's on the blockchain. It doesn't work, but it's on the blockchain." },
      { type: 'LATER', counter: 'URGENCY', line: "Can you hit me up after our token launch? Like, Q3? Q4? Some Q?" },
    ],
  },

  marjorie: {
    speaker: 'marjorie',
    name: 'Dr. Marjorie Ellsworth',
    title: 'Retired DDS (still on the board)',
    company: 'Ellsworth Family Dental Group',
    city: 'Sarasota, FL',
    value: 26000,
    patience: 11,
    interest: 5,
    threshold: 80,
    weak: { RAPPORT: 2.2, HUMOR: 1.6, FLATTERY: 1.3, LOGIC: 0.5, URGENCY: 0.3, FOMO: 0.5 },
    notes: ['Has 7 cats (Molar, Canine, Bicuspid, ...)', 'Nobody has called her in weeks', 'Still controls the practice budget'],
    lines: {
      intro: ["Hello? Oh, a phone call! How lovely. Who is this, dear?", "Ellsworth residence, this is Marjorie. Oh I hope you're not the pharmacy again."],
      pos: ["Oh, you're a delight. You remind me of my late husband Harold. He also talked too much.", "<laugh> Oh stop it. Go on, go on.", "Well isn't that nice. Hold on, Bicuspid is on the counter again. Okay, I'm back."],
      neu: ["Mm, yes, dear.", "Oh, is that right."],
      neg: ["I'm sorry, dear, you lost me. I'm seventy eight.", "That sounds awfully complicated. Is it a pyramid scheme? My neighbor did one of those.", "Oh, you're very serious, aren't you."],
      slur: ["Are you alright, sweetheart? You sound like Harold after the Christmas party. <laugh>"],
      wired: ["Goodness, you talk so fast! Are you having enough water?"],
      silence: ["Hello? Oh, I love a quiet moment. It reminds me of the dentist's chair."],
      closeYes: ["Oh, why not. Harold always said I should live a little. Put me down, dear. And call again sometime, won't you?"],
      closeNo: ["Oh, I'd have to ask the board, dear. The board is my nephew. He never calls.", "Maybe after my stories are over, dear."],
      hangup: ["Oh, my stories are coming on. Lovely to chat, dear. Bye bye now.", "I think I need a nap. Goodbye, sweetheart."],
    },
    objections: [
      { type: 'TANGENT', counter: 'RAPPORT', line: "Oh that reminds me, did I tell you about my cat, Molar? He's got a thyroid thing." },
      { type: 'TRUST', counter: 'HUMOR', line: "My nephew says I shouldn't buy anything over the phone. He's very protective. He never calls, but he's protective." },
      { type: 'CONFUSED', counter: 'FLATTERY', line: "Now what is a cloud, exactly? Is it the one with the rain?" },
    ],
  },

  siobhan: {
    speaker: 'siobhan',
    name: "Siobhan O'Malley",
    title: 'VP of Operations',
    company: 'Shamrock Freight Logistics',
    city: 'Dublin, IE',
    value: 48000,
    patience: 6,
    interest: 20,
    threshold: 70,
    weak: { HUMOR: 1.9, LOGIC: 1.3, RAPPORT: 1.1, URGENCY: 0.4, FLATTERY: 0.5, FOMO: 0.9 },
    notes: ['Allergic to buzzwords', 'Laughs at good jokes, destroys bad ones', 'Time zone: past her dinner'],
    lines: {
      intro: ["Siobhan here. It's half nine at night in Dublin, so this had better be brilliant.", "Yeah, hello? If you say the word synergy I'm hanging up."],
      pos: ["<laugh> Go on, that's actually good, you eejit.", "Right. Okay. That's not nothing.", "Fair play to you. Keep talking."],
      neu: ["Grand.", "Mm. Go on so."],
      neg: ["Jaysus. That's the most American thing I've ever heard.", "You just said synergy with your whole chest.", "I'm yawning. Can you hear me yawning?"],
      slur: ["Are you locked? <laugh> At this hour, on a work call? You absolute legend."],
      wired: ["Take a breath, would you? You sound like a horse at Leopardstown."],
      silence: ["The silence. Very dramatic. Very Samuel Beckett. Are you still there?"],
      closeYes: ["Ah, go on then. You've earned it. Send it over and I'll sign it with my dinner in the other hand."],
      closeNo: ["Ah no. You're not there yet, pet.", "Nice try. No."],
      hangup: ["Right, I'm off. My dinner's gone cold.", "Goodnight, and good luck with your synergy."],
    },
    objections: [
      { type: 'BUZZWORD', counter: 'HUMOR', line: "Is this one of those AI things? Everything's an AI thing now. My kettle's an AI thing." },
      { type: 'BUDGET', counter: 'LOGIC', line: "Show me the numbers. And not the made-up ones on your slide." },
      { type: 'TRUST', counter: 'RAPPORT', line: "How do I know you're not just going to vanish after I sign, like every other lad?" },
    ],
  },

  denise: {
    speaker: 'denise',
    name: 'Denise',
    title: 'Front Desk (Gatekeeper)',
    company: 'Hargrove & Sons Maritime Insurance',
    city: 'Newport, RI',
    value: 0,
    gatekeeper: true,
    next: 'walter',
    patience: 5,
    interest: 10,
    threshold: 55,
    weak: { FLATTERY: 1.5, HUMOR: 1.6, RAPPORT: 1.3, URGENCY: 0.4, LOGIC: 0.6, FOMO: 0.5 },
    notes: ['Gatekeeper. Close = get transferred.', 'Has blocked 11,000 salespeople', 'Loves her cockatiel, Frank'],
    lines: {
      intro: ["Hargrove and Sons, this is Denise. Who's calling and what is this regarding.", "Hargrove and Sons. <sigh> Hold please. Okay, I'm back. What."],
      pos: ["<laugh> Okay, that was a little funny. A little.", "Well aren't you sweet. Keep going, honey.", "Huh. You're not like the other ones."],
      neu: ["Mm-hm.", "Uh huh. And?"],
      neg: ["Honey, I've heard that one eleven thousand times.", "Mr. Hargrove does not take calls from people who say 'circle back'.", "I'm putting you on hold. Forever."],
      slur: ["Sweetie, are you drunk? At least tell me where the party is."],
      wired: ["Honey, you sound like my cockatiel Frank when he gets into the espresso beans."],
      silence: ["Hello? I'm not payin' for this silence."],
      closeYes: ["Fine. You earned it. Transferring you to Mr. Hargrove. God help you."],
      closeNo: ["Nice try, sweetie. He's in a meeting. He's always in a meeting.", "Can I take a message? I'll put it right in the trash."],
      hangup: ["Okay, I'm hanging up now. Have a blessed day.", "Buh-bye."],
    },
    objections: [
      { type: 'MEETING', counter: 'FLATTERY', line: "He's in a meeting. Can I take a message?" },
      { type: 'GATE', counter: 'HUMOR', line: "Is he expecting your call? Because he's not expecting anyone's call. Ever." },
    ],
  },

  walter: {
    speaker: 'walter',
    name: 'Walter Hargrove III',
    title: 'Chairman',
    company: 'Hargrove & Sons Maritime Insurance',
    city: 'Newport, RI',
    value: 240000,
    patience: 6,
    interest: 10,
    threshold: 80,
    weak: { FLATTERY: 2.0, FOMO: 1.6, LOGIC: 0.8, RAPPORT: 0.7, HUMOR: 0.3, URGENCY: 0.4 },
    stubborn: true,
    notes: ['Owns 3 yachts (all named Walter)', 'Great-grandfather insured the Titanic', 'Only respects confidence'],
    lines: {
      intro: ["Hargrove. Denise says you're persistent. I loathe persistence. What is it.", "Walter Hargrove the Third. You have my attention, which is expensive."],
      pos: ["Hm. Yes. Well. That's rather astute.", "You know, my grandfather said something similar. Right before he bought Nantucket.", "Go on. I'm listening, which is itself a privilege."],
      neu: ["Hm.", "Indeed."],
      neg: ["How dreadfully middle class.", "I have yachts older than you, and they're more persuasive.", "Are you reading from a card? I can hear you reading from a card."],
      slur: ["Are you intoxicated, young man? <laugh> Finally, someone civilized."],
      wired: ["You're speaking with the urgency of a man who's never owned a sailboat."],
      silence: ["Ah. Silence. At last, something of value from your company."],
      closeYes: ["Very well. Have your people call my people. My people will call your people. And then, God willing, nobody will call me."],
      closeNo: ["One doesn't simply close a Hargrove. One is invited.", "Absolutely not. I haven't even had my brandy."],
      hangup: ["I've grown bored. Good day.", "Denise will show you out. Metaphorically."],
    },
    objections: [
      { type: 'STATUS', counter: 'FLATTERY', line: "Do you have any idea who my great-grandfather was?" },
      { type: 'VENDOR', counter: 'FOMO', line: "We've used the same broker since nineteen twelve. He's dead now, but we still use him." },
      { type: 'PRICE', counter: 'LOGIC', line: "Price is irrelevant. What is relevant is whether you're worthy." },
    ],
  },

  chip: {
    speaker: 'chip',
    name: 'Chip Donnelly',
    title: 'Regional Sales Director',
    company: 'Midwest Mattress Monopoly',
    city: 'I-94, somewhere near Gary, IN',
    value: 36000,
    patience: 5,
    interest: 25,
    threshold: 60,
    weak: { URGENCY: 1.6, HUMOR: 1.6, RAPPORT: 1.2, LOGIC: 0.5, FLATTERY: 1.0, FOMO: 1.0 },
    notes: ['Is always driving', 'Also in sales (professional courtesy?)', 'Tunnels ahead'],
    lines: {
      intro: ["Chip here, you're on speaker, I'm driving, go. GO!", "Yeah, Chip. Hang on, merging. <groan> Come on, buddy! Okay, go."],
      pos: ["Ha! I like you. You're a closer. I can smell it through the phone.", "Oh, that's good. I'm stealing that. Keep goin'.", "Okay, okay, that's a solid pitch, buddy."],
      neu: ["Yep. Yep.", "Uh huh, hold on, exit's coming up."],
      neg: ["Buddy, I do this for a living. Don't pitch a pitcher.", "Nope, lost you, that was weak. Also a tunnel.", "Come on, you can do better than that. MOVE, lady!"],
      slur: ["Are you drinking on a call? <laugh> Old school. I love it. Don't drive."],
      wired: ["Whoa, you're wired, pal. What're you on, and can I get some?"],
      silence: ["Hello? Hello? Did I hit a tunnel? I hate this tunnel."],
      closeYes: ["You know what, you earned it, buddy. One closer to another. Send it. I'll sign at a red light."],
      closeNo: ["Ha! Nice try. That's the oldest close in the book.", "Not while I'm driving, pal. That's illegal. Probably."],
      hangup: ["Losing you, going into a tunnel, bye!", "Okay I'm at the drive-thru, gotta go."],
    },
    objections: [
      { type: 'DRIVING', counter: 'URGENCY', line: "Can you call me back? I'm literally doing seventy on the interstate." },
      { type: 'PEER', counter: 'HUMOR', line: "Buddy, I've used every line you're about to use. Try something new." },
    ],
  },

  sal: {
    speaker: 'sal',
    name: 'Sal Benedetto',
    title: 'Hungry Guy',
    company: 'Unknown (thinks you are a pizzeria)',
    city: 'Bay Ridge, Brooklyn',
    value: 9000,
    patience: 7,
    interest: 30,
    threshold: 55,
    weak: { HUMOR: 1.8, RAPPORT: 1.6, URGENCY: 1.2, LOGIC: 0.6, FLATTERY: 1.0, FOMO: 0.8 },
    notes: ['Wrong number. Called about pizza.', 'Owns a laundromat chain (!!)', 'Very hungry'],
    lines: {
      intro: ["Yeah, hi, lemme get a large pepperoni, extra cheese, and them garlic knots.", "Tony's? Yeah it's Sal. Usual order. Large pie, half mushroom."],
      pos: ["<laugh> You're a funny guy. This is the weirdest pizza place I ever called.", "Okay, I'm listenin'. But I'm still hungry.", "Huh. That actually sounds like somethin' my laundromats could use."],
      neu: ["Yeah, yeah.", "Okay. So is the pizza comin' or what?"],
      neg: ["I don't want no software, I want a pizza.", "Is this Tony's or not?", "Buddy, my stomach is growlin' and you're talkin' about workflows."],
      slur: ["You sound like my cousin Vinny at a wedding. <laugh> Put me down for a beer too."],
      wired: ["Slow down, pal, you talk like a New York cabbie."],
      silence: ["Hello? Tony? You put me on hold again?"],
      closeYes: ["You know what, sure. Sign me up for the software. And if you ever DO get a pizza, call me."],
      closeNo: ["I don't sign nothin' on an empty stomach.", "No pizza, no deal."],
      hangup: ["Forget it, I'm orderin' Chinese.", "I'm callin' Tony's for real this time."],
    },
    objections: [
      { type: 'PIZZA', counter: 'HUMOR', line: "Wait. This ain't Tony's Pizza, is it." },
      { type: 'HUNGRY', counter: 'URGENCY', line: "Can we do this after I eat? I get cranky when I'm hungry." },
    ],
  },

  mom: {
    speaker: 'mom',
    name: 'Mom',
    title: 'Mom',
    company: 'Home',
    city: 'Home',
    value: 50,
    patience: 99,
    interest: 60,
    threshold: 40,
    weak: { RAPPORT: 2, HUMOR: 2, LOGIC: 2, URGENCY: 2, FLATTERY: 2, FOMO: 2 },
    mom: true,
    notes: ['You dialed your mom by accident', 'She is very proud of you', 'Buys anything you sell'],
    lines: {
      intro: ["Honey? Is that you? Oh, you never call! Is everything alright?", "Sweetheart! I was just thinking about you. Are you eating?"],
      pos: ["Oh, you're so good at your job. I always knew you would be.", "<laugh> You're so funny. You get that from your father.", "That sounds wonderful, honey. I don't understand it, but it sounds wonderful."],
      neu: ["Mm-hm, sweetie.", "Oh, that's nice."],
      neg: ["Honey, are you working too hard? You sound tired.", "Is that a cough? Are you wearing a scarf?", "You sound stressed, sweetie."],
      slur: ["Are you drinking at work? <sigh> Oh, honey. Drink some water. I'm not mad, I'm just worried."],
      wired: ["Why are you talking so fast? Are you having too much coffee? Honey, your heart."],
      silence: ["Hello? Honey? Are you there? Oh I hate these cell phones."],
      closeYes: ["Of course I'll buy one, sweetie. Fifty dollars? Is that enough? I'll put it on the Visa."],
      closeNo: ["Oh I'd have to ask your father, honey."],
      hangup: ["Okay honey, I'll let you work. I love you. Call more. Bye."],
    },
    objections: [
      { type: 'MOM', counter: 'RAPPORT', line: "When are you going to call your sister? She's been asking about you." },
    ],
  },

  victoria: {
    speaker: 'victoria',
    name: 'Victoria Sterling',
    title: 'Chief Financial Officer',
    company: 'OmniCorp Global',
    city: 'London / New York / Everywhere',
    value: 2400000,
    boss: true,
    patience: 7,
    interest: 0,
    threshold: 95,
    decay: 10, // her attention is expensive, and it drains
    weak: { LOGIC: 1.3, FOMO: 1.2, URGENCY: 0.9, FLATTERY: 0.6, RAPPORT: 0.8, HUMOR: 0.5 },
    stubborn: true,
    notes: ['THE WHALE. $2.4M ARR.', 'Has fired 3 vendors this quarter. By text.', 'Four layers of objections. Clear them ALL.'],
    lines: {
      intro: ["Victoria Sterling. You got past four assistants and a firewall. I'm almost impressed. You have one minute.", "This is Sterling. My assistant says you're the one who won't stop calling. Go on then. Amaze me."],
      pos: ["Hm. That's the first intelligent sentence I've heard from a vendor this year.", "Continue. Carefully.", "Interesting. You may have one more minute."],
      neu: ["I see.", "And?"],
      neg: ["That's a no from me, and it's a no from my board.", "I've fired people for saying less.", "Do you know what my time costs per second? Neither can you afford it."],
      slur: ["Are you drunk? <laugh> On a call with me? That takes either courage or a medical condition."],
      wired: ["Breathe. Whatever you've taken, it isn't enough to impress me."],
      silence: ["Silence. A bold negotiating tactic. Unwise, but bold."],
      closeYes: ["Fine. Two point four million, three year term, net ninety. My lawyers will be in touch. Don't make me regret this, Jordan."],
      closeNo: ["No. And if you try that again, I'll have you blacklisted in three industries.", "You haven't earned a yes. Try harder."],
      hangup: ["We're done here. Don't call this number again.", "This conversation is concluded."],
    },
    objections: [
      { type: 'BUDGET', counter: 'LOGIC', line: "My budget is frozen. Glacially. Justify yourself." },
      { type: 'VENDOR', counter: 'FOMO', line: "We have three vendors doing this already. I'm considering firing all of them. Why would I add a fourth?" },
      { type: 'LATER', counter: 'URGENCY', line: "Put something on my calendar for next fiscal year. My calendar is also frozen." },
      { type: 'TRUST', counter: 'RAPPORT', line: "Why should I trust a man who calls strangers for a living?" },
    ],
  },
};

// ── The boss, coworkers and the office ──────────────────────────────────────
export const OFFICE_LINES = {
  chad: {
    morning: [
      "Alright, listen up! Phones up, heads down! Nobody leaves this floor until they close! Let's go, let's GO!",
      "Good morning, closers! And good morning to the rest of you, the ones who are about to become closers or unemployed!",
      "It's Friday! You know what Friday means? It means the week's almost over and you still haven't hit quota! Dial!",
    ],
    close: ["THAT'S what I'm talking about! Ring that gong!", "Yes! YES! Somebody get this animal a steak!", "Now THAT is a closer! Coffee's for closers, and you just earned a pot!"],
    hangup: ["Pick. Up. The. Phone. Again.", "Rejection is just a yes that doesn't know it yet! Dial!", "Shake it off! Next! Next! NEXT!"],
    drunk: ["Hey. Hey! Are you drinking? <sigh> Fine. As long as you're closing."],
    wired: ["Whoa. Your eyes are doing a thing. Whatever it is, sell with it."],
    walkby: ["I'm watching you. In a supportive way. In a very watching way.", "Dials, dials, dials! I want to hear those dials!"],
    quotaHit: ["You hit quota! You beautiful, beautiful machine. Go home. Actually, don't. Keep dialing."],
    quotaMiss: ["You missed quota. You know what that means. Tomorrow you dial like your life depends on it. Because your job does."],
    fired: ["Pack up your desk. The stapler stays."],
    paramedics: ["Okay, everybody, give him some room! Somebody get the paramedics! And somebody take his leads!"],
    victory: ["Victoria Sterling? Two point four million? I, I think I'm gonna cry. Take the corner office. Take MY office!"],
  },
  brad: {
    gong: ["Boom! Closed another one! Brad is BACK, baby!", "That's three today, losers! Somebody count my commission!"],
    taunt: ["Nice call, bro. Real nice. Anyway, I closed four.", "Yo, you want some tips? Tip one: be me."],
  },
};

// Sound effects. Each has a generation prompt for text-to-audio models
// (Stable Audio Open Small, TangoFlux, AudioX, MMAudio) and a procedural
// WebAudio fallback id in src/audio/sfx.js that ships with the game.
export const SFX_PROMPTS = {
  phone_ring: { secs: 3, prompt: 'Vintage 1980s office desk telephone ringing, mechanical bell, single ring cycle, clean close recording' },
  ringback: { secs: 4, prompt: 'US telephone ringback tone heard through a phone earpiece, 440 and 480 hertz, two seconds on four seconds off' },
  pickup: { secs: 1, prompt: 'Plastic office telephone handset lifted off the cradle, click, close foley' },
  hangup: { secs: 1, prompt: 'Telephone handset slammed down onto cradle, loud plastic clack, foley' },
  dial: { secs: 2, prompt: 'Rapid touch tone DTMF dialing on an office phone, ten digits' },
  busy: { secs: 3, prompt: 'Telephone disconnected busy signal tone after the other party hangs up' },
  beer_open: { secs: 2, prompt: 'Aluminum beer can cracked open, sharp pop and fizzing carbonation hiss, close up foley' },
  beer_gulp: { secs: 3, prompt: 'Man chugging beer, three big gulps, satisfied exhale, close microphone' },
  burp: { secs: 1, prompt: 'Short comedic male burp, office' },
  sniff: { secs: 2, prompt: 'One sharp long nasal inhale sniff, close microphone, comedic, dry' },
  heartbeat: { secs: 2, prompt: 'Fast pounding heartbeat, low thumps, cinematic, tense' },
  gong: { secs: 6, prompt: 'Huge brass gong struck hard with a mallet, long shimmering decay, large room' },
  cheer: { secs: 4, prompt: 'Rowdy office sales floor crowd cheering and whooping, men yelling, clapping' },
  cash: { secs: 2, prompt: 'Old mechanical cash register ka-ching bell and drawer opening' },
  typing: { secs: 3, prompt: 'Fast mechanical keyboard typing in an office' },
  ambience: { secs: 20, prompt: 'Busy 1980s trading floor office ambience, distant phone chatter, murmuring voices, phones ringing far away, air conditioning hum, loopable' },
  record_scratch: { secs: 1, prompt: 'Comedic vinyl record scratch' },
  coffee: { secs: 2, prompt: 'Hot coffee poured into a ceramic mug, then a slurp' },
  squeeze: { secs: 1, prompt: 'Foam stress ball squeezed, rubbery squish' },
  vape: { secs: 3, prompt: 'Electronic vape inhale crackle followed by a long exhale' },
  paper: { secs: 2, prompt: 'Stack of paper leads slapped on a desk' },
  alarm: { secs: 3, prompt: 'Ambulance siren passing by outside an office window' },
};
