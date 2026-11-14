# Gettysburg Day 2 (July 2, 1863) - Sources, Map and Fact Sheet

Scope: southern end of the field (Little Round Top, Devil's Den, Wheatfield, Peach Orchard, Cemetery Ridge), about 4 PM to dusk.
Research date: 2026-11-14. No files were downloaded; only URLs were recorded.

## 0. How to read this file

### Verification labels

| Label | Meaning |
|---|---|
| VERIFIED | I fetched the URL (or the scan's own full-text index) and saw the quoted words there. |
| VERIFIED-ITEM | The scan item and its file listing were fetched and the quoted words were found in that scan through the Internet Archive full-text search of the same item, but the PDF binary itself (60-105 MB) was too large for my fetch tool to open. |
| PARTIAL | The URL resolved, but I could not machine-read the content (image-only scan or image file). |
| UNVERIFIED | Inferred, computed, or seen only in a search-result snippet. Check before relying on it. |

### Page numbering used below

- **Printed p.** = the page number printed in the book.
- **Leaf** = Internet Archive `leafNum` (0-based scan index). Leaves marked "FTS" were confirmed by the Internet Archive full-text search endpoint, which returns the leaf on which a phrase occurs. This is the most reliable number in this file.
- **PDF p. (est.)** = my estimate of the 1-based page index inside the archive.org PDF. Archive.org drops "non-access" leaves (colour card, duplicate shots) from the PDF. Where I could read the scan data I subtracted them; where I could not, I assumed only leaf 0 is dropped. **Every PDF index is UNVERIFIED: expect it to be right or off by up to 2. Confirm by the printed page number at the top of the page.**
- One lesson from this research: an LLM-assisted reading of a `_page_numbers.json` file gave a wrong offset for OR vol. 27 part 2 (+12 instead of the true +6). All leaf numbers below were therefore re-checked with the full-text search, not taken from that first reading.

### Practical notes for the extraction API

- The Official Records and Joint Committee PDFs are 91-105 MB. If the extraction API rejects large files, use (a) the smaller `_bw.pdf` variant where listed, (b) the clean per-page HTML fallback, or (c) a single-leaf page image.
- Single-leaf page images: `https://archive.org/download/<ITEM>/page/leaf<LEAF>.jpg` (also `.../page/n<INDEX>.jpg`). These URLs resolved in my tests but I could not read the image content, so treat them as PARTIAL and check one by eye before use.
- Human check link by printed page: `https://archive.org/details/<ITEM>/page/<PRINTED PAGE>/mode/1up` (pattern, not individually fetched).
- Reproducible check of any quote (returns JSON with the leaf number), example:
  `https://ia800402.us.archive.org/fulltext/inside.php?item_id=warofrebellion271unit&doc=warofrebellion271unit&path=/3/items/warofrebellion271unit&q=%22I+ordered+the+bayonet%22`

### Scan items used

| Short name | archive.org item | Direct PDF | Size | Status |
|---|---|---|---|---|
| OR 27/1 (Official Records, Ser. I, Vol. 27, Part 1, Union reports) | `warofrebellion271unit` | https://archive.org/download/warofrebellion271unit/warofrebellion271unit.pdf | 105 MB | VERIFIED-ITEM |
| OR 27/2 (Part 2, Confederate reports) | `warofrebellion272unit` | https://archive.org/download/warofrebellion272unit/warofrebellion272unit.pdf | 93 MB | VERIFIED-ITEM |
| Hood, *Advance and Retreat* (1880) | `advanceretreatpe00hood` | https://archive.org/download/advanceretreatpe00hood/advanceretreatpe00hood.pdf (18.6 MB) or https://archive.org/download/advanceretreatpe00hood/advanceretreatpe00hood_bw.pdf (14 MB) | 14-19 MB | VERIFIED-ITEM |
| Longstreet, *From Manassas to Appomattox* (1895/96) | `manassasappomatt00longrich` | https://archive.org/download/manassasappomatt00longrich/manassasappomatt00longrich.pdf (60 MB) or https://archive.org/download/manassasappomatt00longrich/manassasappomatt00longrich_bw.pdf (45 MB) | 45-60 MB | VERIFIED-ITEM |
| JCCW (Report of the Joint Committee on the Conduct of the War, 1865, vol. 1) | `reportofjointcom01unit` | https://archive.org/download/reportofjointcom01unit/reportofjointcom01unit.pdf | 91 MB | VERIFIED-ITEM |
| Norton, *The Attack and Defense of Little Round Top* (1913) | `attackdefenseofl00nort` | https://archive.org/download/attackdefenseofl00nort/attackdefenseofl00nort.pdf (also `_bw.pdf`) | not read | VERIFIED-ITEM (text found by full-text search; PDF file name follows the archive.org convention and the `_bw.pdf` variant appears in the search index) |

Plain-text fallbacks for every item exist at `https://archive.org/download/<ITEM>/<ITEM>_djvu.txt` (listed in the item file listings; 0.9-4 MB, whole book, no page breaks).

---

## 1. Primary sources per commander

### 1.1 Robert E. Lee

| # | Document | Scan (preferred) | Pages | Clean fallback | Proof phrase | What it evidences | Status |
|---|---|---|---|---|---|---|---|
| L1 | Lee's detailed report on the Gettysburg campaign, January 1864. OR 27/2, printed pp. 313-325; July 2 is on pp. 318-320 | OR 27/2 PDF (see table above) | Printed pp. 318-320 = leaves 324-326 (leaf 324 and 326 FTS) = PDF pp. 324-326 (est.) | https://ehistory.osu.edu/books/official-records/044/0318 , `/0319` , `/0320` (0318 and 0320 fetched) | p. 318: "partially enveloping the enemy's left, which he was to drive in". p. 320: "The general plan was unchanged." | Lee's intent and reasoning: he did not plan a general battle but judged it "unavoidable"; orders Longstreet to envelop and drive in the Union left; after the day's partial gains he decides to keep attacking. Shows an aggressive, persistent commander who gives broad directives and expects "proper concert of action" from subordinates. | VERIFIED-ITEM (scan), VERIFIED (HTML) |
| L2 | Lee's preliminary report, July 31, 1863. OR 27/2, printed pp. 305-311; July 2 on p. 308 | OR 27/2 PDF | Printed p. 308 = leaf 314 (computed from the +6 offset, not FTS) = PDF p. 314 (est.); take 307-309 as the 3-page window | https://ehistory.osu.edu/books/official-records/044/0308 | "A battle thus became, in a measure, unavoidable" | Shorter, earlier statement of the same logic: why he fought at Gettysburg, what Longstreet was ordered to take, and that "partial successes determined me to continue the assault next day." | VERIFIED (HTML); scan leaf UNVERIFIED |

Coverage note: Lee wrote no personal memoir. His own voice on July 2 exists only in these two reports, which are formal and say nothing about his exchanges with Longstreet or Hood. His refusals of the flanking move are documented from the other side (Longstreet G1, Hood H1).

### 1.2 James Longstreet

| # | Document | Scan (preferred) | Pages | Clean fallback | Proof phrase | What it evidences | Status |
|---|---|---|---|---|---|---|---|
| G1 | *From Manassas to Appomattox*, ch. XXVII "Gettysburg - Second Day" (chapter starts printed p. 362) | Longstreet PDF (see table above) | Printed pp. 366-368 = leaves 434-436 (leaf 435 and 436 FTS) = PDF pp. 434-436 (est.) | Perseus, with printed page markers: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:2001.05.0027:chapter=27 ; excerpt at https://www.battlefields.org/learn/articles/longstreet-gettysburg-second-day | p. 367: "General Lee's orders were to guide my left by the Emmitsburg road". p. 368: "General Hood appealed again and again for the move to the right" | The refusal itself, in Longstreet's words: Hood asked repeatedly to go around the right; Longstreet answered that the move had been proposed the day before and rejected by Lee. Shows a subordinate who disagreed with the plan but enforced it to the letter. | VERIFIED-ITEM (scan), VERIFIED (both HTML pages) |
| G2 | Longstreet's official report, July 27, 1863. OR 27/2, printed pp. 357-363; July 2 on pp. 358-359 | OR 27/2 PDF | Printed pp. 358-359 = leaves 364-365 (leaf 364 FTS) = PDF pp. 364-365 (est.) | https://ehistory.osu.edu/books/official-records/044/0358 , `/0359` (both fetched) | p. 358: "Fearing that my force was too weak to make an attack, I delayed" | Contemporary account: he waited for Law's brigade, lost time on the concealed march, McLaws in position "about 4 p.m.", Hood "partially enveloping the enemy's left". Evidence of caution and deliberate pace. | VERIFIED-ITEM (scan), VERIFIED (HTML) |

Caution for persona building: the memoir (1895/96) is polemical and written 30 years later. On Perseus p. 384 Longstreet says Lee was "excited and off his balance". Use it as Longstreet's view of Lee, not as fact about Lee.

### 1.3 John Bell Hood

| # | Document | Scan (preferred) | Pages | Clean fallback | Proof phrase | What it evidences | Status |
|---|---|---|---|---|---|---|---|
| H1 | Hood's letter to Longstreet, New Orleans, June 28, 1875, printed in *Advance and Retreat* (1880), printed pp. 55-59 | Hood PDF (see table above; the `_bw.pdf` is 14 MB) | Printed pp. 57-59 = leaves 69-71 (leaf 69 and 71 FTS) = PDF pp. 67-69 (est.; scan data shows leaves 0, 15, 16 are dropped from the PDF) | https://www.wtj.com/archives/hood/hood03b.htm | p. 59: "which protest is the first and only one I ever made". pp. 57-58: "General Lee's orders are to attack up the Emmetsburg road" | His Texas scouts report the Union left on Round Top and open ground behind it; he asks to turn Round Top; he is refused; he renews the request; Longstreet in person says "We must obey the orders of General Lee"; Hood attacks and is wounded about twenty minutes later. Shows an aggressive division commander who protests and then obeys. | VERIFIED-ITEM (scan), VERIFIED (HTML) |

Coverage note (weak): Hood was wounded and never wrote an official report for Gettysburg (he says so in this letter). The only first-person source is this letter written "from memory" twelve years later. The number of requests is usually given as three (two staff officers, then in person); the letter supports that count. Longstreet's G1 and G2 corroborate the substance. The Perseus copy of chapter 3 (https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:2001.05.0056:chapter=3) resolved but my fetch did not show the letter text there, so it is not listed as a fallback.

### 1.4 George G. Meade

| # | Document | Scan (preferred) | Pages | Clean fallback | Proof phrase | What it evidences | Status |
|---|---|---|---|---|---|---|---|
| M1 | Meade's official report, October 1, 1863. OR 27/1, printed pp. 114-119; July 2 on p. 116 | OR 27/1 PDF | Printed pp. 115-117 = leaves 133-135 (leaf 134 FTS) = PDF pp. 133-135 (est.) | https://ehistory.osu.edu/books/official-records/043/0116 | "not fully apprehending the instructions in regard to the position to be occupied" | Meade's intent for the III Corps (prolong the II Corps line on Cemetery Ridge), his discovery of Sickles half to three-quarters of a mile forward, and his reaction: feed in V Corps, II Corps, VI Corps and XII Corps troops. Measured, restrained wording about a subordinate's error. | VERIFIED-ITEM (scan), VERIFIED (HTML) |
| M2 | "Minutes of council, July 2, 1863" (Butterfield's pencil notes found in Meade's papers). OR 27/1, printed pp. 73-74 | OR 27/1 PDF | Printed pp. 73-74 = leaves 91-92 (both FTS) = PDF pp. 91-92 (est.) | https://ehistory.osu.edu/books/official-records/043/0073 , `/0074` (both fetched). Narrative by a participant: Gibbon, "The Council of War on the Second Day", *Battles and Leaders* vol. 3 pp. 313-314: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:2001.05.0045:chapter=4.43 | "Stay and fight it out." | The three questions and each general's answer (table in section 3d). Shows Meade polling his corps commanders to build consensus one week into command. | VERIFIED-ITEM (scan), VERIFIED (HTML) |
| M3 (optional) | Meade's testimony to the Joint Committee, March 1864. JCCW vol. 1, printed pp. 331-332 | JCCW PDF | Printed pp. 331-332 = leaves 411-412 (leaf 412 FTS) = PDF pp. 411-412 (est.) | none found | "he had advanced his line beyond the support of my army" | His face-to-face exchange with Sickles: Sickles offers to withdraw, Meade says the enemy will not permit it, and the guns open before he finishes the sentence. | VERIFIED-ITEM |

### 1.5 Daniel E. Sickles

| # | Document | Scan (preferred) | Pages | Clean fallback | Proof phrase | What it evidences | Status |
|---|---|---|---|---|---|---|---|
| S1 | Sickles's testimony to the Joint Committee on the Conduct of the War, February 26, 1864. JCCW vol. 1 (1865), printed pp. 295-304; the key passage is on p. 298 | JCCW PDF (see table above). Second scan of the same volume at the Library of Congress: https://www.loc.gov/item/2024792228/ (item page fetched; I could not open its image manifest) | Printed pp. 297-299 = leaves 377-379 (leaf 378 FTS) = PDF pp. 377-379 (est.) | Excerpts on a secondary site: https://www.hardtackbooks.com/hardtackblog/sicklesgoestowashington (fetched; contains the key passage, no page citations) | "It was not through any misinterpretation of orders." | He rejects Meade's and Halleck's "misinterpretation" explanation and owns the decision: he "determined to wait no longer the absence of orders" and took the advanced line "on my own responsibility" because it was "commanding ground". Shows self-assurance, initiative to the point of insubordination, and readiness to argue his case politically. | VERIFIED-ITEM (scan), VERIFIED (HTML excerpt) |

Coverage note (weak): Sickles lost his leg on July 2 and filed no official report. This testimony is self-justifying and given seven months later to a committee hostile to Meade. There is no clean full-text HTML of the testimony that I could verify; the fallback is an excerpt on a blog. Pair it with Meade's M1 and M3 for the other side.

### 1.6 Gouverneur K. Warren

| # | Document | Scan (preferred) | Pages | Clean fallback | Proof phrase | What it evidences | Status |
|---|---|---|---|---|---|---|---|
| W1 | Warren's letter to Capt. Porter Farley, July 13, 1872, printed in Norton, *The Attack and Defense of Little Round Top* (1913), from printed p. 308 | Norton PDF (see table above) | Printed pp. 308-310 = leaves 328-330 (leaf 329 = p. 309 FTS; leaf 328 carries no printed number) = PDF pp. 326-328 (est.; scan data shows leaves 0, 136, 137 dropped) | Letter text quoted at https://penelope.uchicago.edu/Thayer/E/Gazetteer/Places/America/United_States/Army/USMA/Cullums_Register/1451*.html (URL resolved; letter text seen in the search index, my fetch could not confirm source attribution on the page) and in part at http://gdg.org/research/People/Chamberlain/savior1.html (fetched) | "I saw that this was the key of the whole position" | He finds no troops on the hill, only a signal station; has a battery fire a shot to reveal the hidden enemy line; calls the discovery "intensely thrilling to my feelings and almost appalling"; sends a hasty dispatch to Meade for a division. Shows an engineer's eye for ground, quick improvisation and personal initiative. | VERIFIED-ITEM (scan), PARTIAL (first HTML), VERIFIED (second HTML, excerpt only) |
| W2 | Warren's testimony to the Joint Committee, March 1864. JCCW vol. 1, printed p. 377 | JCCW PDF | Printed pp. 376-378 = leaves 458-460 (leaf 459 FTS) = PDF pp. 456-458 (est.; leaves 0, 434, 435 dropped) | none found | "we would at once have to occupy that place very strongly" | Contemporary (eight months after) and much plainer version: Meade sent him, he saw the enemy lines, he sent word, Sykes's troops "arrived barely in time". Useful contrast with the more dramatic 1872 letter. | VERIFIED-ITEM |

Coverage note (moderate): Warren filed no battle report. The vivid account is from 1872; the 1864 testimony calls the hill "Bald Top" and is brief.

### 1.7 Joshua L. Chamberlain

| # | Document | Scan (preferred) | Pages | Clean fallback | Proof phrase | What it evidences | Status |
|---|---|---|---|---|---|---|---|
| C1 | Chamberlain's report as printed in the Official Records, "Field near Emmitsburg, July 6, 1863". OR 27/1, printed pp. 622-626 | OR 27/1 PDF | Printed pp. 623-625 = leaves 643-645 (leaf 644 = p. 624 FTS) = PDF pp. 643-645 (est.) | https://ehistory.osu.edu/books/official-records/043/0623 , `/0624` , `/0625` , `/0626` (all four fetched); full text also at https://gettysburg.stonesentinels.com/union-monuments/maine/20th-maine/official-reports-for-the-20th-maine-at-gettysburg/ (fetched) | p. 624: "At that crisis, I ordered the bayonet. The word was enough." | Vincent's order to "hold that ground at all hazards" (p. 623); refusing the left wing; ammunition gone; the decision to charge rather than be struck; the right wheel; 9 PM advance up Round Top with 200 men (p. 625); 386 engaged, loss 136 (p. 626). Shows calm analysis under pressure and a choice of attack as the last resort. | VERIFIED-ITEM (scan), VERIFIED (HTML) |
| C2 | Chamberlain's original handwritten battle report, July 6, 1863, Maine State Archives (identifier 15-46350-F021-I002), 8 pages per the State Archives listing | Landing page: https://digitalmaine.com/chamberlain_corr/4 . Direct PDF: https://digitalmaine.com/cgi/viewcontent.cgi?article=1003&context=chamberlain_corr | All 8 pages matter; which 3 pages hold the charge is UNVERIFIED (I could not read the scan). Suggested split: pp. 1-3, 4-6, 7-8 | Transcription: https://joshualawrencechamberlain.com/gettysburgreportoriginal.php (fetched) | "As a last, desperate resort, I ordered a charge." | A genuinely messy handwritten scan of the same event in different words: "our ammunition utterly failed", the word "fix bayonets" passing from man to man, and Vincent's instruction that the position "must be held at every hazard". | Landing page VERIFIED (rights: "No Copyright - United States", rightsstatements.org NoC-US). Direct PDF PARTIAL (reached, no extractable text, consistent with an image-only scan). Transcription VERIFIED. |

Important for persona extraction: C1 and C2 carry the same date but are different texts. The wording differs sentence by sentence (compare the two proof phrases). Historians generally say the Official Records version was rewritten by Chamberlain years later for the War Department; I did not verify that explanation in a fetched source (UNVERIFIED), but the difference between the two texts is VERIFIED. If the persona should reflect July 1863, prefer C2; if it should reflect the polished public Chamberlain, C1.

### 1.8 Verification tally for section 1

| Category | Count |
|---|---|
| Documents listed | 13 (L1, L2, G1, G2, H1, M1, M2, M3, S1, W1, W2, C1, C2) |
| Documents whose key passage I confirmed in the scan item or in fetched HTML | 13 |
| Scan leaf ranges confirmed by full-text search on at least one leaf | 11 of 13 (not L2, not C2) |
| PDF page indices | 0 confirmed; all are estimates (see section 0) |
| Clean HTML/TXT fallback confirmed | 9 documents (L1, L2, G1, G2, H1, M1, M2, C1, C2); excerpt only for S1 and W1; none for M3 and W2 |

---

## 2. Period maps (public domain)

| # | Map | Item page | Direct image (IIIF) | Rights | Status |
|---|---|---|---|---|---|
| MAP1 | "Battle field of Gettysburg", survey of 1868-69 under Bvt. Maj. Gen. G. K. Warren, revised 1873; U.S. Army Office of the Chief of Engineers [187-?]. Detailed topography, no troop positions. Library of Congress call no. G3824.G3 187- W3, digital id g3824g.cw0353500 | https://www.loc.gov/item/99448794/ | https://tile.loc.gov/image-services/iiif/service:gmd:gmd382:g3824:g3824g:cw0353500/full/pct:12.5/0/default.jpg (change `pct:12.5` to `pct:25` or `pct:50` for more detail) | U.S. Government work published in the 1870s. Collection statement: "The content of the Library of Congress Geography and Map Division digitized collections is free to use and reuse unless a Rights Advisory statement is present" (none seen on the item). Credit line: Library of Congress, Geography and Map Division. | VERIFIED (item page and image URL both resolved; image recognised as a Gettysburg battlefield map) |
| MAP2 | John B. Bachelder, "Map of the battle field of Gettysburg. July 1st, 2nd, 3rd, 1863" (1876), three sheets on the Warren survey base with troop positions and movement arrows: First, Second and Third day's battle. Scale 1:12,000 | https://www.loc.gov/item/99447491/ ; sheet page https://www.loc.gov/resource/g3824g.cw0325000b/ | https://tile.loc.gov/image-services/iiif/service:gmd:gmd382:g3824:g3824g:cw0325000b/full/pct:12.5/0/default.jpg | Published 1876; same collection statement and credit line as MAP1. | Item page VERIFIED; image URL resolved and shows a Gettysburg topographic map. That sheet "b" is the Second day's battle is inferred from the a/b/c order of the digital ids (UNVERIFIED): if it is the wrong day, try `cw0325000a` or `cw0325000c`. |
| MAP3 (alternate copy) | Same Bachelder set, another Library of Congress copy | https://www.loc.gov/resource/glva01.lva00068c | not retrieved | as above | UNVERIFIED (seen in search results only) |

Recommendation: MAP2 sheet for July 2 is the best visual reference for the simulation because it shows unit positions at several times of day. MAP1 is the cleanest terrain base.

Rights statement source: https://www.loc.gov/collections/civil-war-maps/about-this-collection/rights-and-access/ (fetched).

---

## 3. Fact sheet for the simulation

Source keys used in this section:

| Key | Source |
|---|---|
| WP2 | Wikipedia, "Battle of Gettysburg, second day": https://en.wikipedia.org/wiki/Battle_of_Gettysburg,_second_day |
| WPL | Wikipedia, "Little Round Top": https://en.wikipedia.org/wiki/Little_Round_Top |
| SS-CSA | Stone Sentinels strength and casualty table, Confederate: https://gettysburg.stonesentinels.com/battle-of-gettysburg-facts/strength-casualties-csa/ |
| SS-USA | Stone Sentinels strength and casualty table, Union: https://gettysburg.stonesentinels.com/battle-of-gettysburg-facts/strength-casualties-usa/ |
| SS-ANV | Stone Sentinels, organisation of the Army of Northern Virginia: https://gettysburg.stonesentinels.com/armies/army-of-northern-virginia/ |
| SS-2C / SS-3C / SS-5C | Stone Sentinels corps pages: https://gettysburg.stonesentinels.com/armies/army-of-the-potomac/2nd-corps/ , `/3rd-corps/` , `/5th-corps/` |
| NPS5 | National Park Service Civil War Series, The Battle of Gettysburg, section 5: https://www.nps.gov/parkhistory/online_books/civil_war_series/16/sec5.htm |
| NPS-PO | National Park Service, The Peach Orchard: https://www.nps.gov/places/the-peach-orchard.htm |
| ABT | American Battlefield Trust, Gettysburg: https://www.battlefields.org/learn/civil-war/battles/gettysburg |
| ABT-LRT | American Battlefield Trust, Defense of Little Round Top: https://www.battlefields.org/learn/articles/defense-little-round-top |
| GA-W / GA-L | Gettysburg Animated timelines (hobbyist site, gives no citations; use for relative order, treat clock times as approximate): https://gettysburganimated.com/whathappenedhere/the-wheatfield/ , https://gettysburganimated.com/whathappenedhere/little-round-top/ |
| GDG | Gettysburg Discussion Group essay "The Saviors of Little Round Top": http://gdg.org/research/People/Chamberlain/savior1.html |
| L1, G1, H1, M1, M2, M3, S1, W1, W2, C1 | The primary documents in section 1 |

All of these were fetched. Strength figures from SS-CSA and SS-USA are rounded "engaged" strengths for the whole battle (the site says they come mostly from the Official Records and that sources often disagree). Treat every number as approximate, plus or minus a few percent.

### 3a. Order of battle, southern field, July 2

#### Confederate: Longstreet's First Corps (two divisions present; Pickett's division did not reach the field in time to fight on July 2)

| Division | Brigade | Commander (fate on July 2) | Regiments | Approx. strength | Source |
|---|---|---|---|---|---|
| Hood's Division, Maj. Gen. John B. Hood (wounded early; Brig. Gen. Evander M. Law succeeded) | whole division incl. artillery | | | 7,371 | SS-CSA, SS-ANV |
| | Law's Brigade | Brig. Gen. Evander M. Law (to division command; Col. James L. Sheffield) | 4th, 15th, 44th, 47th, 48th Alabama | 1,930 | SS-CSA, SS-ANV |
| | Robertson's (Texas) Brigade | Brig. Gen. Jerome B. Robertson (wounded) | 3rd Arkansas, 1st, 4th, 5th Texas | 1,735 | SS-CSA, SS-ANV |
| | G. T. Anderson's Brigade | Brig. Gen. George T. Anderson (wounded) | 7th, 8th, 9th, 11th, 59th Georgia | 1,875 | SS-CSA, SS-ANV |
| | Benning's Brigade | Brig. Gen. Henry L. Benning | 2nd, 15th, 17th, 20th Georgia | 1,420 | SS-CSA, SS-ANV |
| | Henry's Artillery Battalion | Maj. Mathias W. Henry | | 400 | SS-CSA |
| McLaws' Division, Maj. Gen. Lafayette McLaws | whole division incl. artillery | | | 6,926 | SS-CSA |
| | Kershaw's Brigade | Brig. Gen. Joseph B. Kershaw | 2nd, 3rd, 7th, 8th, 15th South Carolina (and 3rd SC Battalion) | 2,180 | SS-CSA, SS-ANV |
| | Barksdale's Brigade | Brig. Gen. William Barksdale (mortally wounded) | 13th, 17th, 18th, 21st Mississippi | 1,620 | SS-CSA, SS-ANV |
| | Semmes' Brigade | Brig. Gen. Paul J. Semmes (mortally wounded) | 10th, 50th, 51st, 53rd Georgia | 1,335 | SS-CSA, SS-ANV |
| | Wofford's Brigade | Brig. Gen. William T. Wofford | 16th, 18th, 24th Georgia, Cobb's Legion, Phillips' Legion, 3rd Georgia Sharpshooters | 1,400 | SS-CSA, SS-ANV |
| | Cabell's Artillery Battalion | Col. Henry C. Cabell | | 380 | SS-CSA |
| Corps reserve artillery (Alexander's and the Washington Artillery battalions) | | Col. E. Porter Alexander directing | | 915 | SS-CSA |

#### Confederate: R. H. Anderson's Division of A. P. Hill's Third Corps (attacked Cemetery Ridge from about 6 PM)

| Brigade | Commander | Approx. strength | Engaged July 2? | Source |
|---|---|---|---|---|
| Wilcox's Brigade (Alabama) | Brig. Gen. Cadmus M. Wilcox | 1,725 | Yes | SS-CSA, WP2 |
| Perry's Brigade (Florida) | Col. David Lang | 740 | Yes | SS-CSA, WP2 |
| Wright's Brigade (Georgia) | Brig. Gen. Ambrose R. Wright | 1,415 | Yes | SS-CSA, WP2 |
| Posey's Brigade (Mississippi) | Brig. Gen. Carnot Posey | 1,320 | Partly | SS-CSA, WP2 |
| Mahone's Brigade (Virginia) | Brig. Gen. William Mahone | 1,540 | No, never advanced | SS-CSA, WP2 |
| Division total | Maj. Gen. Richard H. Anderson | about 7,135 | | SS-ANV |

Data warning: the SS-CSA table row for "Anderson's Division" reads 5,096 strength and 2,023 losses, which is identical to the SS-USA row for Birney's Union division and does not match the sum of its own brigades (6,740). It looks like a copy error on that site. Use about 7,100 (SS-ANV).

#### Union: III Corps, Maj. Gen. Daniel E. Sickles (wounded about 6 PM; Maj. Gen. David B. Birney succeeded)

Corps strength: 10,691 (SS-USA). The SS-3C page says 13,000; the lower figure is the one normally quoted for troops engaged.

| Division | Brigade | Commander (fate on July 2) | Approx. strength | Source |
|---|---|---|---|---|
| 1st Division, Maj. Gen. David B. Birney | whole division | | about 5,100 | SS-3C, SS-USA |
| | 1st Brigade | Brig. Gen. Charles K. Graham (wounded and captured) | 1,516 | SS-USA, SS-3C |
| | 2nd Brigade | Brig. Gen. J. H. Hobart Ward | 2,190 | SS-USA |
| | 3rd Brigade | Col. P. Regis de Trobriand | 1,390 (SS-USA) or 2,010 (SS-3C); sources disagree, the lower figure is the usual one | SS-USA, SS-3C |
| 2nd Division, Brig. Gen. Andrew A. Humphreys | whole division | | 4,935 | SS-USA |
| | 1st Brigade | Brig. Gen. Joseph B. Carr | 1,715 | SS-USA |
| | 2nd (Excelsior) Brigade | Col. William R. Brewster | 1,840 (SS-USA) or 1,450 (SS-3C) | SS-USA, SS-3C |
| | 3rd Brigade | Col. George C. Burling (regiments parcelled out to other sectors) | 1,365 | SS-USA |
| Artillery Brigade | | Capt. George E. Randolph (wounded) | 600 men, 30 guns | SS-USA, SS-3C |

#### Union: V Corps, Maj. Gen. George Sykes

Corps strength: 10,904 (SS-USA).

| Division | Brigade | Commander (fate on July 2) | Notes | Approx. strength | Source |
|---|---|---|---|---|---|
| 1st Division, Brig. Gen. James Barnes (wounded) | whole division | | | 3,415 | SS-USA |
| | 1st Brigade | Col. William S. Tilton | Stony Hill / Wheatfield | 655 | SS-USA |
| | 2nd Brigade | Col. Jacob B. Sweitzer | Wheatfield | 1,420 | SS-USA |
| | 3rd Brigade | Col. Strong Vincent (mortally wounded; Col. James C. Rice succeeded) | Little Round Top. Line from left to right: 20th Maine (Col. Joshua L. Chamberlain, 386 men), 83rd Pennsylvania (Capt. Orpheus S. Woodward), 44th New York (Col. James C. Rice), 16th Michigan (Lt. Col. Norval E. Welch, 263 men) | 1,335 | SS-USA, SS-5C, WPL, C1 |
| 2nd Division, Brig. Gen. Romeyn B. Ayres | whole division | | | 4,025 | SS-USA |
| | 1st Brigade (U.S. Regulars) | Col. Hannibal Day | east edge of Wheatfield | 1,575 | SS-USA |
| | 2nd Brigade (U.S. Regulars) | Col. Sidney Burbank | Wheatfield | 960 | SS-USA |
| | 3rd Brigade | Brig. Gen. Stephen H. Weed (killed; Col. Kenner Garrard succeeded) | Little Round Top: 140th New York (Col. Patrick O'Rorke, killed; about 450 men per GA-L), 146th New York, 91st and 155th Pennsylvania | 1,485 | SS-USA, SS-5C |
| 3rd Division (Pennsylvania Reserves), Brig. Gen. Samuel W. Crawford | whole division | | | 2,850 | SS-USA |
| | 1st Brigade | Col. William McCandless | dusk counter-charge from Little Round Top's north slope | 1,245 | SS-USA, WP2 |
| | 3rd Brigade | Col. Joseph W. Fisher | sent to the Round Tops at nightfall | 1,600 | SS-USA |
| Artillery | Battery D, 5th U.S. | Lt. Charles E. Hazlett (killed) | guns hauled to the crest of Little Round Top | | WPL |

#### Union: II Corps reinforcements, Maj. Gen. Winfield S. Hancock

| Unit | Commander (fate on July 2) | Where used | Approx. strength | Source |
|---|---|---|---|---|
| 1st Division, Brig. Gen. John C. Caldwell | | Wheatfield, from about 6 PM | 3,212 (SS-USA) or 3,320 (SS-2C) | SS-USA, SS-2C |
| 1st Brigade | Col. Edward E. Cross (mortally wounded) | Wheatfield | 850 | SS-USA |
| 2nd (Irish) Brigade | Col. Patrick Kelly | Stony Hill | 530 | SS-USA |
| 3rd Brigade | Brig. Gen. Samuel K. Zook (mortally wounded) | Stony Hill | 975 | SS-USA |
| 4th Brigade | Col. John R. Brooke (wounded) | Wheatfield to Rose Woods | 850 (SS-USA) or 1,060 (SS-2C) | SS-USA, SS-2C |
| 3rd Brigade, 3rd Division | Col. George L. Willard (killed) | counter-attack on Barksdale near Plum Run | 1,510 | SS-USA, WP2 |
| 1st Minnesota (Harrow's 1st Brigade, 2nd Division) | Col. William Colvill (wounded) | charge against Wilcox's brigade at Plum Run | 262 in the charge | WP2 |

### 3b. Where each force was at about 4 PM

| Force | Position at about 4 PM | Source |
|---|---|---|
| Hood's Division | Extreme Confederate right, in Biesecker's Woods on Warfield Ridge astride the Emmitsburg Road, two lines: Law (right front), Robertson (left front), Benning (right rear), G. T. Anderson (left rear). Not yet advancing. | WP2 |
| McLaws' Division | On Hood's left, on Warfield / southern Seminary Ridge opposite the Peach Orchard, two lines: Kershaw (right front), Barksdale (left front), Semmes (right rear), Wofford (left rear). "In position ... about 4 p.m." | WP2, G2 |
| R. H. Anderson's Division | On McLaws' left along Seminary Ridge, facing Cemetery Ridge; in place since about noon. | NPS5 |
| III Corps, Birney's division | Advanced salient: Ward on Houck's Ridge above Devil's Den (left end of the line); de Trobriand at Stony Hill / Wheatfield with a gap between him and Ward; Graham at the Peach Orchard (the angle). | WP2 |
| III Corps, Humphreys' division | Along the Emmitsburg Road north of the Peach Orchard (Carr and Brewster); Burling's regiments distributed as reinforcements. Roughly half to three-quarters of a mile in front of the II Corps. | WP2, M1 |
| Little Round Top | Unoccupied except for a Signal Corps station. Warren arrives between about 3:30 and 4 PM (sources differ). | W1, WPL, GDG, GA-L |
| V Corps | Moving from reserve behind the Union centre toward the left on Meade's order; Barnes's division leading (Vincent's brigade about to be diverted to Little Round Top); Ayres and Crawford following. | M1, C1 |
| Caldwell's division, II Corps | On Cemetery Ridge at the left of the II Corps line, in reserve position. | WP2 |
| 1st Minnesota | On Cemetery Ridge with Hancock's II Corps. | WP2 |
| Meade | Riding to Sickles's line; in his report he says about 3 PM, in his testimony "a few minutes before 4 o'clock". | M1, M3 |

### 3c. Timeline, about 4 PM to dusk

All clock times are approximate. Watches were not synchronised in 1863 and participants' times for the same event commonly differ by 30 to 60 minutes. Where sources disagree the range is shown.

| Time (approx.) | Event | Source |
|---|---|---|
| Shortly after noon to about 3 PM | Sickles advances the III Corps from lower Cemetery Ridge to the Emmitsburg Road, Peach Orchard and Devil's Den line without orders. Longstreet's two divisions make a long concealed march and countermarch. | NPS5, WP2, M1 |
| About 3 PM | Longstreet's artillery opens. Meade, after a meeting of corps commanders, rides toward Sickles. | G1, M1 |
| 3:30 to 4 PM | Warren reaches Little Round Top, finds only signalmen, has a battery fire a shot that reveals the Confederate line, and sends for troops. | W1, GDG, GA-L |
| Just before 4 PM | Meade tells Sickles he is too far out; Sickles offers to withdraw; Meade says the enemy will not allow it; the cannonade begins as they talk. | M3, M1 |
| About 4 PM | Hood and McLaws are in position on Warfield Ridge. Hood sends scouts, then asks repeatedly to move around Round Top; Longstreet refuses each time. | G2, H1, G1 |
| About 4:30 PM | Hood's division steps off, Law and Robertson leading. | WP2 |
| 4:30 to 5 PM | Hood is hit by a shell burst and carried off (his letter: about twenty minutes after starting). Law succeeds him but does not at first know it. | WP2, H1, G2 |
| 4:15 to 5 PM | Vincent's brigade reaches the southern slope of Little Round Top and deploys; 20th Maine on the far left. | GA-L, C1, WPL |
| 4:45 to 5:30 PM | 4th and 5th Texas and 4th Alabama assault Vincent's centre and right three times; 15th and 47th Alabama come over Big Round Top against the 20th Maine. At the same time Ward's brigade fights Robertson, part of Law, then Benning at Devil's Den. | GA-L, WP2 |
| About 5 PM | G. T. Anderson attacks the stone wall on the south edge of the Wheatfield. Longstreet orders in Kershaw, who advances on the Rose farm and Stony Hill about 5:30. | GA-W, WP2 |
| About 5:30 PM | Warren diverts the 140th New York from Weed's column; O'Rorke leads it over the crest and is killed; the Union right on the hill is saved. Hazlett's guns reach the summit. Vincent is mortally wounded about this time. | GA-L, WPL |
| 5:30 to 6 PM (not precisely timed in the sources fetched) | Ward is forced off Houck's Ridge; Benning's and Robertson's men take Devil's Den and three guns of Smith's battery. | WP2, H1 |
| 5:45 to 6:15 PM | Caldwell's division (Cross, Kelly, Zook, Brooke) arrives and sweeps the Wheatfield and Stony Hill. Cross and Zook are mortally wounded. | GA-W, WP2 |
| About 6 PM | R. H. Anderson's division begins its attack on the Emmitsburg Road and Cemetery Ridge (Wilcox, Lang, Wright). | WP2 |
| 6 to 6:30 PM | Barksdale's brigade breaks the Peach Orchard angle; Graham is wounded and captured; Sickles's leg is shattered by a cannonball near the Trostle farm and Birney takes the corps; Humphreys' division falls back fighting. The Peach Orchard position is overrun about 6:30 PM. | NPS-PO, WP2 |
| 6:05 to 7 PM (disputed) | 20th Maine, out of ammunition, fixes bayonets and charges, left wing wheeling to the right; Company B and sharpshooters fire into the Alabamians' rear; the 15th and 47th Alabama break. Chamberlain's reports give no clock time; GA-L puts it at 6:05 to 6:15, many narratives put it nearer 6:30 to 7. | C1, ABT-LRT, GA-L |
| 6:30 to 7:10 PM | Wofford, Kershaw, Semmes and Anderson drive Caldwell, Sweitzer and the U.S. Regulars out of the Wheatfield. | GA-W, WP2 |
| About sunset (roughly 7 to 7:30 PM) | Hancock sends Willard's brigade against Barksdale (Barksdale mortally wounded, Willard killed) and orders the 1st Minnesota to charge Wilcox at Plum Run. Wright briefly reaches the crest of Cemetery Ridge and is driven back. | WP2 |
| About 7:30 PM | Confederates crossing the Wheatfield reach Plum Run below Little Round Top; Crawford's Pennsylvania Reserves (McCandless) charge and push them back across the Wheatfield. Longstreet stops the attack. | WP2, GA-W |
| About 7:30 PM | Sunset (local time, approximate; taken from a forum post citing 7:32 PM, not from an astronomical table). | UNVERIFIED |
| About 8 PM | Fighting on the southern field ends in darkness. | GA-W, L2 ("The battle ceased at dark") |
| About 9 PM | Chamberlain takes about 200 men of the 20th Maine up Big Round Top with bayonets fixed. | C1 (p. 625) |
| Evening, "soon after all firing had ceased" | Meade's council of war at his headquarters (the Leister house). Exact hour not given in the sources fetched. | M2, Gibbon |

### 3d. Documented command decisions

#### Decision 1: Sickles advances the III Corps against Meade's intent

| Item | Fact | Source |
|---|---|---|
| Meade's intent | III Corps to hold the continuation of Cemetery Ridge on the left of the II Corps, its left toward Round Top. | M1 |
| Who decided | Sickles alone. He told the Joint Committee he "determined to wait no longer the absence of orders" and took the line "on my own responsibility", claiming general approval from Gen. Hunt. | S1 |
| When | Movement began shortly after noon and was still under way about 3 PM. | NPS5, M1 |
| Why (his account) | The Peach Orchard ground was higher and he feared the enemy would use it as an artillery platform. Modern accounts add his memory of giving up Hazel Grove at Chancellorsville. | S1, WP2 |
| Meade's response | Rode out, told Sickles the line was beyond support; judged it too late to withdraw; ordered the V Corps to the left and later Caldwell's division, the VI Corps and XII Corps troops. | M1, M3 |
| Consequence | A salient too long for 10,700 men; the corps lost about 4,200 and was wrecked as a fighting unit, but the attack fell on it before reaching the main ridge. | SS-USA, WP2 |

#### Decision 2: Hood asks to go around Round Top; Longstreet refuses, citing Lee

| Item | Fact | Source |
|---|---|---|
| Lee's order | Attack up (guide the left by) the Emmitsburg Road, enveloping and driving in the Union left. | L1, G1, H1 |
| Hood's information | Scouts reported the Union left on Round Top, open country around it, and wagon trains exposed behind. | H1 |
| Hood's requests | First by a staff officer; second by another officer; third in person when Longstreet rode up as the line moved. Hood calls it the only protest of his career. | H1 |
| Longstreet's replies | Each time that General Lee's orders were to attack up the Emmitsburg Road; in person, "We must obey the orders of General Lee." In his memoir: the move had been proposed the day before and rejected. | H1, G1 |
| When | About 4 to 4:30 PM, between arrival on Warfield Ridge and the advance. | G2, WP2 |
| Background | Longstreet himself had urged a move around the Union left and had been overruled by Lee; he enforced the order regardless. | G1, WP2 |

#### Decision 3: Warren finds Little Round Top undefended

| Item | Fact | Source |
|---|---|---|
| Who sent Warren | Meade, at Warren's own suggestion (1872 letter); "by General Meade's direction" (1864 testimony). | W1, W2 |
| What he found | No troops, only a signal station. A shot fired at his request from a rifle battery near Devil's Den made the hidden Confederates move and their bayonets glint. | W1 |
| Who he called | A written dispatch to Meade asking for at least a division; staff officers (Lt. Ranald Mackenzie, Lt. Washington Roebling and others) sent to find troops. Sickles, asked through Mackenzie, said he could spare none. | W1, WPL, GDG |
| Who answered first | Sykes ordered Barnes's division to send a brigade. Col. Strong Vincent intercepted the courier and took his brigade to the hill on his own responsibility, without waiting for Barnes. | WPL, GDG |
| Who answered next | Warren personally pulled the 140th New York (O'Rorke) out of Weed's column; Hazlett's battery was dragged to the summit; the rest of Weed's brigade followed. | GA-L, WPL, W1 |
| Outcome for the men involved | Vincent, O'Rorke, Weed and Hazlett were all killed or mortally wounded on the hill; Warren was slightly wounded. | WPL, SS-5C |

#### Decision 4: Chamberlain's bayonet charge

| Item | Fact | Source |
|---|---|---|
| Orders received | Vincent: this is the extreme left; "hold that ground at all hazards." | C1 (p. 623) |
| Situation | 386 men; left wing bent back to face the 15th Alabama; about a third of the regiment down; ammunition exhausted; men preparing to club muskets. | C1 (pp. 624, 626) |
| The decision | Chamberlain judged it "imperative to strike before we were struck" and ordered the bayonet. Left wing swung forward in a right wheel; the line swept the front of the brigade. | C1 (p. 624) |
| Other contributors | Lt. Holman Melcher sprang out in front of the line; Capt. Morrill's detached Company B and some U.S. Sharpshooters fired from behind a stone wall into the Confederate rear. Col. William C. Oates of the 15th Alabama later said he had already decided to withdraw. | ABT-LRT, WPL, GA-L |
| Result claimed | About 400 prisoners; 20th Maine lost 136 (30 killed). Modern counts of the regiment's loss are slightly lower (about 125 to 130). | C1 (pp. 625-626) |
| When | Roughly 6 to 7 PM; no time in his reports. | GA-L, WPL |

#### Decision 5: Meade's council of war, evening of July 2

Held at Meade's headquarters after the firing stopped. Present per Gibbon: Meade, Butterfield (chief of staff, who wrote the questions and tallied the answers), Warren (wounded, asleep in a corner according to later accounts), and Generals Newton, Hancock, Gibbon, Birney, Sykes, Sedgwick, Howard, Williams and Slocum. Source for the table: M2 (OR 27/1 pp. 73-74), with Gibbon's narrative for context.

Questions: (1) Stay in the present position or retire nearer the base of supplies? (2) If staying, attack or await attack? (3) If awaiting attack, how long?

| General (command) | Q1 Stay or retire | Q2 Attack or wait | Q3 How long |
|---|---|---|---|
| Gibbon (II Corps, acting) | Correct the position, but do not retreat | In no condition to attack | Until the enemy moves |
| Williams (XII Corps, acting) | Stay | Wait attack | One day |
| Birney (III Corps, acting) | Same as Williams | Same | Same |
| Sykes (V Corps) | Same as Williams | Same | Same |
| Newton (I Corps) | Correct the position, but do not retreat | By all means not attack | Waiting gives them a chance to cut our line |
| Howard (XI Corps) | Remain | Wait attack until 4 PM tomorrow | If they do not attack, attack them |
| Hancock (left centre / II Corps) | Rectify position without giving up the field | Not attack unless communications are cut | Cannot wait long; cannot be idle |
| Sedgwick (VI Corps) | Remain | Wait attack | At least one day |
| Slocum (right wing / XII Corps) | "Stay and fight it out" | | |

Result: unanimous to stay; all but conditional voices to await attack. Meade's closing words per Gibbon: "Such then is the decision." Afterwards Meade told Gibbon that if Lee attacked the next day it would be on Gibbon's front, the centre (Gibbon; WP2). A side memorandum on the same sheet records Newton calling it "a bad position" and Birney saying the III Corps was "used up".

### 3e. Historical end state at dusk

| Location | Held by at nightfall | Detail | Source |
|---|---|---|---|
| Little Round Top | Union | Vincent's (now Rice's) and Weed's (now Garrard's) brigades with Hazlett's battery; never taken. | M1, WPL |
| Big Round Top | Contested at dusk, Union by late evening | Confederates of Law's brigade on the western slope; the 20th Maine climbed it about 9 PM and Fisher's brigade followed. | C1 (p. 625), NPS (section 8 of the same series, seen in search results) |
| Devil's Den and Houck's Ridge | Confederate | Benning's and Robertson's men held it for about the next 22 hours. | WP2 |
| The Wheatfield | Neither; a no man's land | Changed hands several times (often said to be six). At dark the Union line (Crawford, Regulars, VI Corps units) held its eastern edge and Confederates held Stony Hill and Rose Woods on the west. | GA-W, WP2 |
| The Peach Orchard and Emmitsburg Road | Confederate | Longstreet: left "resting at the peach orchard". Alexander's artillery moved onto it. | G2 (p. 359), NPS-PO |
| Cemetery Ridge | Union | Wilcox, Lang and Wright were all repulsed; the line Meade originally intended was re-formed with II, V, VI, XII and I Corps troops. | M1, WP2 |

#### Approximate casualties

| Scope | Union | Confederate | Source and caveat |
|---|---|---|---|
| Whole day, whole field (includes Culp's Hill and Cemetery Hill) | about 10,000 | about 6,800 | WP2, citing historian Noah Trudeau's estimate |
| Southern field only (Hood, McLaws, Anderson against III, V and part of II Corps) | probably more than 9,000 | about 6,000 (30 to 40 percent of those engaged) | WP2; estimates, since returns were made for the whole battle, not per day |
| Little Round Top | 565 of 2,996 engaged (134 killed, 402 wounded, 29 missing) | 1,185 of 4,864 engaged (279 killed, 868 wounded, 219 missing) | WPL |
| Devil's Den | 821 of 2,423 engaged | 1,814 of 5,525 engaged | WP2 |
| Wheatfield | about 30 percent of 20,444 engaged, both sides combined (roughly 6,000) | | WP2; the rough total is my arithmetic |
| III Corps (whole battle, nearly all on July 2) | 4,226 of 10,691 | | SS-USA |
| Hood's Division (whole battle, mostly July 2) | | 2,363 of 7,371 (under-reported) | SS-CSA |
| McLaws' Division (whole battle, mostly July 2) | | 2,230 of 6,926 (under-reported) | SS-CSA |
| Barksdale's Brigade | | 745 of 1,620 (46 percent) | SS-CSA |
| Caldwell's Division | 1,273 of 3,212 (40 percent) | | SS-USA |
| U.S. Regulars (Day and Burbank) | 829 of 2,613 | | WP2 |
| 20th Maine | 136 of 386 by Chamberlain's count (30 killed) | | C1 (p. 626) |
| 1st Minnesota, the July 2 charge | 215 of 262 (82 percent) | | WP2; the exact numbers engaged and lost are debated by historians, 262 and 215 are the traditional figures |
| Whole battle, three days, for scale | 23,049 | 28,063 | ABT (SS tables give 22,822 and 22,709; Confederate returns are incomplete) |

Senior officers lost on the southern field on July 2: Union: Sickles (wounded), Graham (captured), Vincent, Weed, O'Rorke, Hazlett, Cross, Zook, Willard (killed or mortally wounded), Barnes and Brooke (wounded). Confederate: Hood, G. T. Anderson, Robertson (wounded), Barksdale and Semmes (mortally wounded). Sources: SS-2C, SS-3C, SS-5C, SS-ANV, L1 (p. 320), G2 (p. 359).

---

## 4. Known gaps and cautions

1. PDF page indices are estimates. The leaf numbers are solid; the PDF index can differ by 1 to 2 pages. Check the printed page number on the first extraction run.
2. Three of the seven commanders (Hood, Sickles, Warren) wrote no official report on Gettysburg. Their personas rest on later testimony or letters (1864, 1872, 1875), each with an agenda.
3. Lee is documented only through formal reports; they reveal reasoning but little personality.
4. Chamberlain has two different "July 6, 1863" texts (C1 printed, C2 manuscript). Decide which one the persona should be built from, or use both and let the difference show.
5. The Chamberlain manuscript PDF and the per-leaf JPG image URLs resolved but could not be read by my tools; they need a visual check.
6. Clock times for July 2 are soft everywhere. The timeline uses ranges; the Gettysburg Animated times are uncited.
7. Strength figures differ between pages of the same site (de Trobriand, Brewster, Brooke, the III Corps total, Anderson's Division). Ranges are given where found.
8. The identity of Bachelder sheet "b" as the Second day's map is inferred.
9. A few details in section 3 come from general knowledge of the battle and were not confirmed in a source fetched for this file (UNVERIFIED): the commands shown in brackets in the council table; Warren being wounded and asleep during the council; the Wheatfield changing hands "six" times; the modern lower count of 20th Maine losses (about 125 to 130); Fisher's brigade following the 20th Maine up Big Round Top; Col. Cabell's first name and rank; Alexander's guns moving onto the Peach Orchard; the Hazel Grove comparison by name.
10. Not fetched at all (blocked or too large for the tool): the Library of Congress IIIF manifest for the Joint Committee volume, and the full PDFs and `_djvu.txt` files on archive.org (their existence was confirmed from the item file listings).
