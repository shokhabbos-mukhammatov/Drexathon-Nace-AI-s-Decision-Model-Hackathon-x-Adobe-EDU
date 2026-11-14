# Clio: pitch outline (five slides, five minutes)

The deck uses the wartime portraits and Clio's period palette. One idea per slide.

## The story to tell (thirty seconds, before slide 1)

Wide, the brother of a colleague, teaches historical battles at West Point. Cadets there study how commanders made decisions, and one way they learn is the staff ride: standing on a battlefield such as Gettysburg and asking, at each moment, what would you have done here, and why did he do what he did?

That exercise needs a trip, a historian and a day, and it can only ever show the one way the battle went. Clio is built for that teaching problem: put a cadet in Longstreet's or Sickles's place, let them decide, and watch the other commanders answer in character, from their own documents.

Rules for telling it, so the story stays true:
- Say Clio is built for the kind of teaching Wide does. Do not say West Point uses it, endorses it, or took part, unless Wide has said so.
- No West Point name, crest or photos on the slides as branding; say it in words.
- If Wide gives you a reaction or a sentence you may quote, with their permission, it goes on slide 1 with their name and role as they want them written. That is worth more than any other line in the deck.
- Ask before naming Wide at all.

## 1. The problem
**Title:** A staff ride takes a bus, a historian and a day.
- At West Point, cadets learn command decisions from historical battles; a staff ride puts them on the ground at Gettysburg. (Wide teaches this.)
- Most students never get one, and even those who do see only the one way it went. A textbook tells you what happened, not what it was to decide it.
- Visual: the map, the word CLIO, "Stand where they stood." [Optional: Wide's quote, with permission.]

## 2. What Clio is
**Title:** Every commander is an agent. Every decision is Drex.
- A real battle on a period map, replayed by about 28 agents a turn in three tiers.
- Each commander's character comes from his own reports and letters, read by NDI, with the page cited.
- Left alone, they replay July 2, 1863. Take a command, and history bends.
- Visual: screenshot of the map mid-battle.

## 3. Live demo (three minutes of the five)
1. NDI persona: Longstreet's own report becomes four cited traits.
2. Let history run: Sickles disobeys, Hood protests, Longstreet refuses, Warren finds the hill empty, Chamberlain orders the bayonet. Watch the ledger.
3. New battle. Take Sickles. Type "Hold Cemetery Ridge as ordered." Drex reads the sentence, the corps stays, and the afternoon comes out differently.
4. Click a decision: "why?" shows which trait moved it.
5. Dusk: council of war, ground held against 1863, the after-action report written by Intern.

## 4. Why it needs Nace
**Title:** About 170 decisions a battle, in a third of a second each, for a fifth of a cent.
- Measured on this build: one full battle is about 170 Drex decisions, about 18 seconds of wall time, $0.0019.
- The same 30 decisions on a general 27B model on DeepInfra: 7 times the cost at its fastest (reasoning off, and it agreed with Drex on 29 of 30), 77 times the cost and 27 times slower when it thinks first.
- Drex can only answer with a legal move, with a probability on each: nothing to parse, no invented orders, and the pull of history is visible on screen.
- NDI read 1860s scans from archive.org and returned each trait with the sentence and page it came from. A teaching tool cannot make up its sources.
- History fidelity on autopilot (live Drex, seed 1863): 8 of 9 documented decisions with the NDI personas, 7 of 8 without. The count barely moves; what changes is the behaviour. With his persona Hood protests and is refused, as he was. Without it he ignores the order and goes around the Round Tops.
- Be ready for: "does Drex just know Gettysburg?" Partly, yes: Sickles advances even with no persona, and the no-persona run ended the day closer to 1863 on the ground (5 of 5 key positions against 3 of 5). Do not claim the personas make it more accurate overall. Claim what is true: they make each commander act in character, with a cited source, and the player's own decisions are where it leaves the record.

## 5. What is next
**Title:** Any battle. Any decision worth rehearsing.
- First: put it in front of instructors who teach command decisions, such as Wide, and build the battles they teach next. (Say "we will ask", not "we have agreed", unless that is true.)
- A battle is one data file plus its documents.
- The same pattern rehearses any documented decision under pressure: incident response, a negotiation, a boardroom.
- Tools used: Drex, NDI, Intern, DeepInfra; Adobe Express and Firefly for the deck.
- Visual: the seven portraits in a row.
