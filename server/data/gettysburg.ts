// Gettysburg, July 2, 1863: the southern field, 3:00 PM to dusk.
// Strengths, positions and documented decisions come from docs/research/gettysburg-sources.md.
// Everything battle-specific lives in this file so another battle is another data file.
import type { MapEdge, MapNode, Side, Trait } from '../../shared/types.ts';

export const BATTLE = {
  name: 'Gettysburg, the second day',
  date: 'July 2, 1863',
  startMinutes: 14 * 60 + 30,
  turnMinutes: 30,
  maxTurns: 11,
};

export const NODES: MapNode[] = [
  { id: 'seminary_n', name: 'Seminary Ridge', short: "Lee's HQ", x: 150, y: 150, terrain: 'ridge', defense: 1.2, hq: 'confederate' },
  { id: 'seminary_c', name: "Spangler's Woods", short: "Spangler's Woods", x: 300, y: 330, terrain: 'woods', defense: 1.2 },
  { id: 'pitzer', name: "Pitzer's Woods", short: "Pitzer's Woods", x: 360, y: 560, terrain: 'woods', defense: 1.2 },
  { id: 'warfield', name: 'Warfield Ridge', short: 'Warfield Ridge', x: 430, y: 800, terrain: 'ridge', defense: 1.2 },
  { id: 'emmitsburg_rd', name: 'Emmitsburg Road', short: 'Emmitsburg Rd', x: 640, y: 370, terrain: 'farm', defense: 1.05 },
  { id: 'peach_orchard', name: 'The Peach Orchard', short: 'Peach Orchard', x: 590, y: 570, terrain: 'farm', defense: 1.1, objective: true, historical: 'confederate' },
  { id: 'trostle', name: 'Trostle Farm', short: 'Trostle Farm', x: 790, y: 480, terrain: 'farm', defense: 1.0 },
  { id: 'rose_woods', name: 'Rose Woods and Stony Hill', short: 'Rose Woods', x: 690, y: 690, terrain: 'woods', defense: 1.2 },
  { id: 'wheatfield', name: 'The Wheatfield', short: 'Wheatfield', x: 830, y: 650, terrain: 'open', defense: 1.0, objective: true, historical: 'contested' },
  { id: 'devils_den', name: "Devil's Den", short: "Devil's Den", x: 850, y: 810, terrain: 'rocks', defense: 1.35, objective: true, historical: 'confederate' },
  { id: 'plum_run', name: 'Plum Run Valley', short: 'Plum Run', x: 960, y: 700, terrain: 'open', defense: 0.95 },
  { id: 'big_round_top', name: 'Big Round Top', short: 'Big Round Top', x: 1030, y: 920, terrain: 'hill', defense: 1.4 },
  { id: 'little_round_top', name: 'Little Round Top', short: 'Little Round Top', x: 1075, y: 775, terrain: 'hill', defense: 1.5, objective: true, historical: 'union' },
  { id: 'cemetery_ridge_s', name: 'Cemetery Ridge, the left', short: 'Cemetery Ridge', x: 1050, y: 520, terrain: 'ridge', defense: 1.25, objective: true, historical: 'union' },
  { id: 'cemetery_ridge_c', name: 'Cemetery Ridge, the centre', short: 'Ridge centre', x: 1010, y: 300, terrain: 'ridge', defense: 1.3 },
  { id: 'meade_hq', name: 'Leister House', short: "Meade's HQ", x: 1150, y: 170, terrain: 'farm', defense: 1.0, hq: 'union' },
  { id: 'reserve', name: 'Baltimore Pike', short: 'V Corps reserve', x: 1400, y: 430, terrain: 'open', defense: 1.0 },
];

export const EDGES: MapEdge[] = [
  { a: 'seminary_n', b: 'seminary_c', via: [[215, 250]] },
  { a: 'seminary_c', b: 'pitzer', via: [[315, 450]] },
  { a: 'pitzer', b: 'warfield', via: [[380, 690]] },
  { a: 'seminary_c', b: 'emmitsburg_rd', via: [[470, 330]] },
  { a: 'pitzer', b: 'peach_orchard', road: 'Millerstown Road', via: [[470, 575]] },
  { a: 'warfield', b: 'peach_orchard', road: 'Emmitsburg Road', via: [[500, 690]] },
  { a: 'peach_orchard', b: 'emmitsburg_rd', road: 'Emmitsburg Road', via: [[612, 470]] },
  { a: 'warfield', b: 'rose_woods', via: [[560, 760]] },
  { a: 'warfield', b: 'devils_den', via: [[640, 830]], ford: 'Rose Run' },
  { a: 'warfield', b: 'big_round_top', via: [[720, 905]], ford: 'Rose Run' },
  { a: 'peach_orchard', b: 'trostle', via: [[690, 515]] },
  { a: 'peach_orchard', b: 'rose_woods' },
  { a: 'peach_orchard', b: 'wheatfield', road: 'Wheatfield Road', via: [[710, 595]] },
  { a: 'rose_woods', b: 'wheatfield' },
  { a: 'rose_woods', b: 'devils_den', via: [[760, 760]], ford: 'Rose Run' },
  { a: 'wheatfield', b: 'devils_den' },
  { a: 'wheatfield', b: 'trostle' },
  { a: 'wheatfield', b: 'plum_run', road: 'Wheatfield Road', via: [[895, 665]], ford: 'Plum Run' },
  { a: 'devils_den', b: 'plum_run', ford: 'Plum Run' },
  { a: 'devils_den', b: 'big_round_top', via: [[930, 880]], ford: 'Plum Run' },
  { a: 'big_round_top', b: 'little_round_top' },
  { a: 'plum_run', b: 'little_round_top', ford: 'Plum Run' },
  { a: 'plum_run', b: 'cemetery_ridge_s', via: [[1000, 610]], ford: 'Plum Run' },
  { a: 'little_round_top', b: 'cemetery_ridge_s', via: [[1075, 640]] },
  { a: 'trostle', b: 'cemetery_ridge_s', via: [[920, 490]], ford: 'Plum Run' },
  { a: 'emmitsburg_rd', b: 'trostle' },
  { a: 'emmitsburg_rd', b: 'cemetery_ridge_c', via: [[830, 320]] },
  { a: 'cemetery_ridge_s', b: 'cemetery_ridge_c', via: [[1040, 410]] },
  { a: 'cemetery_ridge_c', b: 'meade_hq', road: 'Taneytown Road', via: [[1090, 230]] },
  { a: 'meade_hq', b: 'reserve', via: [[1290, 280]] },
  { a: 'reserve', b: 'cemetery_ridge_s', road: 'Granite Schoolhouse Lane', via: [[1230, 470]] },
  { a: 'reserve', b: 'little_round_top', via: [[1260, 620]] },
];

/** Who holds what before the first shot. Anything not listed is empty. */
export const INITIAL_CONTROL: Record<string, Side> = {
  seminary_n: 'confederate', seminary_c: 'confederate', pitzer: 'confederate', warfield: 'confederate',
  cemetery_ridge_s: 'union', cemetery_ridge_c: 'union', meade_hq: 'union', reserve: 'union',
};

/** Where a beaten unit falls back toward. */
export const BASES: Record<Side, string[]> = {
  confederate: ['warfield', 'pitzer', 'seminary_c'],
  union: ['cemetery_ridge_s', 'cemetery_ridge_c', 'reserve'],
};

const OR1 = 'Official Records, Series I, Vol. 27, Part 1';
const OR2 = 'Official Records, Series I, Vol. 27, Part 2';

export interface CommanderSeed {
  id: string;
  name: string;
  rank: string;
  role: string;
  side: Side;
  tier: 'army' | 'corps' | 'brigade';
  superiorId?: string;
  nodeId: string;
  /** One paragraph the decider reads as background. */
  brief: string;
  traits: Trait[];
}

export const COMMANDERS: CommanderSeed[] = [
  {
    id: 'lee', name: 'Robert E. Lee', rank: 'General', role: 'Army of Northern Virginia', side: 'confederate', tier: 'army',
    nodeId: 'seminary_n',
    brief: 'Commanding general of the Army of Northern Virginia, on the second day of a battle he did not plan to fight here.',
    traits: [
      { id: 'seeks_battle', label: 'Seeks decision by attack', text: 'He judges a general battle unavoidable and means to win it by attacking.', citation: { doc: `Lee's preliminary report, July 31, 1863 (${OR2})`, url: 'https://ehistory.osu.edu/books/official-records/044/0308', page: 'p. 308', quote: 'A battle thus became, in a measure, unavoidable' } },
      { id: 'broad_directives', label: 'Gives broad directives', text: 'He names the objective and leaves the execution to his corps commanders.', citation: { doc: `Lee's report, January 1864 (${OR2})`, url: 'https://ehistory.osu.edu/books/official-records/044/0318', page: 'p. 318', quote: "partially enveloping the enemy's left, which he was to drive in" } },
      { id: 'holds_plan', label: 'Holds to the plan', text: 'Once committed he does not revise the plan; partial success confirms him in it.', citation: { doc: `Lee's report, January 1864 (${OR2})`, url: 'https://ehistory.osu.edu/books/official-records/044/0320', page: 'p. 320', quote: 'The general plan was unchanged.' } },
      { id: 'declined_flank', label: 'Has declined the flank march', text: 'He has already heard the proposal to move around the Union left and rejected it.', citation: { doc: 'Longstreet, From Manassas to Appomattox, ch. XXVII', url: 'https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:2001.05.0027:chapter=27', page: 'p. 367', quote: "General Lee's orders were to guide my left by the Emmitsburg road" } },
    ],
  },
  {
    id: 'longstreet', name: 'James Longstreet', rank: 'Lt. Gen.', role: 'First Corps', side: 'confederate', tier: 'corps', superiorId: 'lee',
    nodeId: 'pitzer',
    brief: "Lee's senior corps commander, directing the attack of Hood's and McLaws' divisions against the Union left.",
    traits: [
      { id: 'prefers_manoeuvre', label: 'Prefers manoeuvre', text: "He argued for moving around the enemy's left rather than assaulting it, and was overruled by Lee.", citation: { doc: 'Longstreet, From Manassas to Appomattox, ch. XXVII', url: 'https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:2001.05.0027:chapter=27', page: 'pp. 366-368' } },
      { id: 'enforces_orders', label: 'Enforces orders to the letter', text: "He disagrees with the plan but will not depart from Lee's order, nor let a subordinate depart from it.", citation: { doc: 'Hood to Longstreet, June 28, 1875 (Advance and Retreat)', url: 'https://www.wtj.com/archives/hood/hood03b.htm', page: 'pp. 57-58', quote: "General Lee's orders are to attack up the Emmetsburg road" } },
      { id: 'deliberate', label: 'Deliberate, slow to commit', text: 'He waits until his force is complete and in place before he attacks.', citation: { doc: `Longstreet's report, July 27, 1863 (${OR2})`, url: 'https://ehistory.osu.edu/books/official-records/044/0358', page: 'p. 358', quote: 'Fearing that my force was too weak to make an attack, I delayed' } },
      { id: 'hard_fighter', label: 'Hits hard once engaged', text: 'When the attack goes in he presses it with every brigade he has.' },
    ],
  },
  {
    id: 'hood', name: 'John Bell Hood', rank: 'Maj. Gen.', role: "Hood's Division", side: 'confederate', tier: 'corps', superiorId: 'longstreet',
    nodeId: 'warfield',
    brief: "Commander of the division on the extreme Confederate right, facing Devil's Den and the Round Tops.",
    traits: [
      { id: 'aggressive', label: 'Aggressive fighter', text: 'He is among the most aggressive division commanders in the army and expects to attack.' },
      { id: 'trusts_scouts', label: 'Acts on reconnaissance', text: 'His Texas scouts report the Union left resting on Round Top with open country and wagon trains behind it.', citation: { doc: 'Hood to Longstreet, June 28, 1875 (Advance and Retreat)', url: 'https://www.wtj.com/archives/hood/hood03b.htm', page: 'pp. 57-58' } },
      { id: 'protests_then_obeys', label: 'Protests, then obeys', text: 'He will argue against an order he thinks wrong, more than once, and then carry it out.', citation: { doc: 'Hood to Longstreet, June 28, 1875 (Advance and Retreat)', url: 'https://www.wtj.com/archives/hood/hood03b.htm', page: 'p. 59', quote: 'which protest is the first and only one I ever made' } },
      { id: 'leads_front', label: 'Leads from the front', text: 'He rides with his leading brigades into the attack.' },
    ],
  },
  {
    id: 'meade', name: 'George G. Meade', rank: 'Maj. Gen.', role: 'Army of the Potomac', side: 'union', tier: 'army',
    nodeId: 'meade_hq',
    brief: 'Commanding general of the Army of the Potomac, in command for five days, holding a defensive line south of Gettysburg.',
    traits: [
      { id: 'strong_ground', label: 'Chooses strong ground', text: 'He means to hold the line of Cemetery Ridge with its left resting on the Round Tops and receive the attack there.', citation: { doc: `Meade's report, October 1, 1863 (${OR1})`, url: 'https://ehistory.osu.edu/books/official-records/043/0116', page: 'p. 116' } },
      { id: 'measured', label: 'Measured with subordinates', text: "He describes a subordinate's error in restrained terms rather than condemning it.", citation: { doc: `Meade's report, October 1, 1863 (${OR1})`, url: 'https://ehistory.osu.edu/books/official-records/043/0116', page: 'p. 116', quote: 'not fully apprehending the instructions in regard to the position to be occupied' } },
      { id: 'pragmatic', label: 'Pragmatic under fire', text: 'Faced with a line pushed too far forward he judges whether it can still be withdrawn before he orders it, and reinforces what he cannot undo.', citation: { doc: 'Meade, testimony to the Joint Committee on the Conduct of the War, March 1864', url: 'https://archive.org/details/reportofjointcom01unit', page: 'pp. 331-332', quote: 'he had advanced his line beyond the support of my army' } },
      { id: 'consensus', label: 'Builds consensus', text: 'He polls his corps commanders before a major decision.', citation: { doc: `Minutes of council, July 2, 1863 (${OR1})`, url: 'https://ehistory.osu.edu/books/official-records/043/0073', page: 'pp. 73-74', quote: 'Stay and fight it out.' } },
    ],
  },
  {
    id: 'sickles', name: 'Daniel E. Sickles', rank: 'Maj. Gen.', role: 'III Corps', side: 'union', tier: 'corps', superiorId: 'meade',
    nodeId: 'cemetery_ridge_s',
    brief: 'Commander of the III Corps on the low southern end of Cemetery Ridge; a politician, not a professional soldier.',
    traits: [
      { id: 'own_judgement', label: 'Acts on his own judgement', text: 'He owns his decisions and does not accept that he merely misread his orders.', citation: { doc: 'Sickles, testimony to the Joint Committee on the Conduct of the War, February 26, 1864', url: 'https://www.hardtackbooks.com/hardtackblog/sicklesgoestowashington', page: 'p. 298', quote: 'It was not through any misinterpretation of orders.' } },
      { id: 'commanding_ground', label: 'Wants the commanding ground', text: 'He believes the higher ground at the Peach Orchard dominates his assigned position and fears the enemy will plant artillery there.', citation: { doc: 'Sickles, testimony to the Joint Committee on the Conduct of the War, February 26, 1864', url: 'https://www.hardtackbooks.com/hardtackblog/sicklesgoestowashington', page: 'pp. 297-299' } },
      { id: 'will_not_wait', label: 'Will not wait for orders', text: 'When orders do not come he acts without them, on his own responsibility.', citation: { doc: 'Sickles, testimony to the Joint Committee on the Conduct of the War, February 26, 1864', url: 'https://www.hardtackbooks.com/hardtackblog/sicklesgoestowashington', page: 'p. 298' } },
      { id: 'political', label: 'Political general', text: 'A former congressman who argues his own case forcefully and is confident of his standing.' },
    ],
  },
  {
    id: 'warren', name: 'Gouverneur K. Warren', rank: 'Brig. Gen.', role: 'Chief Engineer', side: 'union', tier: 'corps', superiorId: 'meade',
    nodeId: 'meade_hq',
    brief: "Chief engineer of the Army of the Potomac, on Meade's staff, with no troops of his own.",
    traits: [
      { id: 'engineers_eye', label: "Engineer's eye for ground", text: 'He reads terrain at a glance and recognises which height controls a position.', citation: { doc: 'Warren to Porter Farley, July 13, 1872 (Norton, Attack and Defense of Little Round Top)', url: 'http://gdg.org/research/People/Chamberlain/savior1.html', page: 'p. 309', quote: 'I saw that this was the key of the whole position' } },
      { id: 'initiative', label: 'Acts without waiting', text: 'He sends for troops on his own authority and diverts passing regiments in person.' },
      { id: 'urgent', label: 'Presses urgency', text: 'When he sees a danger he says so at once and insists it be met in strength.', citation: { doc: 'Warren, testimony to the Joint Committee on the Conduct of the War, March 1864', url: 'https://archive.org/details/reportofjointcom01unit', page: 'p. 377', quote: 'we would at once have to occupy that place very strongly' } },
    ],
  },
  {
    id: 'chamberlain', name: 'Joshua L. Chamberlain', rank: 'Col.', role: '20th Maine', side: 'union', tier: 'brigade', superiorId: 'warren',
    nodeId: 'reserve',
    brief: 'Colonel of the 20th Maine, 386 men, the regiment on the far left of the brigade sent to Little Round Top; a college professor before the war.',
    traits: [
      { id: 'holds_at_hazards', label: 'Holds at all hazards', text: 'His brigade commander has told him this is the extreme left of the army and must be held whatever it costs.', citation: { doc: `Chamberlain's report, July 6, 1863 (${OR1})`, url: 'https://ehistory.osu.edu/books/official-records/043/0623', page: 'p. 623', quote: 'hold that ground at all hazards' } },
      { id: 'calm_analysis', label: 'Calm analysis under pressure', text: 'He reasons through his situation coolly while under fire and adapts his line to it.', citation: { doc: `Chamberlain's report, July 6, 1863 (${OR1})`, url: 'https://ehistory.osu.edu/books/official-records/043/0624', page: 'p. 624' } },
      { id: 'attack_last_resort', label: 'Attacks as the last resort', text: 'When he can no longer hold by fire he will strike rather than wait to be struck.', citation: { doc: "Chamberlain's handwritten report, July 6, 1863 (Maine State Archives)", url: 'https://digitalmaine.com/chamberlain_corr/4', quote: 'As a last, desperate resort, I ordered a charge.' } },
    ],
  },
];

export interface UnitSeed {
  id: string;
  name: string;
  short: string;
  side: Side;
  leader: string;
  commanderId: string;
  agentId?: string;
  nodeId: string;
  strength: number;
  ammo?: number;
  inReserve?: boolean;
  /** Route of nodes the unit works along, per objective id. */
  sectors: Record<string, string[]>;
  /** Mock decider only: the turn this unit historically went in. */
  hintTurn?: number;
  /** Mock decider only: where Meade historically sent a reserve. */
  hintTarget?: string;
  /** Place in the en echelon sequence, right to left (Confederate attackers). */
  echelon?: number;
}

export const UNITS: UnitSeed[] = [
  // Hood's Division
  { id: 'law', name: "Law's Brigade", short: 'Law', side: 'confederate', leader: 'Brig. Gen. Evander M. Law', commanderId: 'hood', nodeId: 'warfield', strength: 1930, echelon: 1, hintTurn: 3, sectors: { emmitsburg_road: ['big_round_top', 'little_round_top'], flank_round_tops: ['big_round_top', 'little_round_top'] } },
  { id: 'robertson', name: "Robertson's Texas Brigade", short: 'Robertson', side: 'confederate', leader: 'Brig. Gen. Jerome B. Robertson', commanderId: 'hood', nodeId: 'warfield', strength: 1735, echelon: 2, hintTurn: 3, sectors: { emmitsburg_road: ['devils_den', 'plum_run'], flank_round_tops: ['big_round_top', 'little_round_top'] } },
  { id: 'benning', name: "Benning's Brigade", short: 'Benning', side: 'confederate', leader: 'Brig. Gen. Henry L. Benning', commanderId: 'hood', nodeId: 'warfield', strength: 1420, echelon: 3, hintTurn: 3, sectors: { emmitsburg_road: ['devils_den'], flank_round_tops: ['devils_den', 'plum_run'] } },
  { id: 'gt_anderson', name: "G. T. Anderson's Brigade", short: 'Anderson', side: 'confederate', leader: 'Brig. Gen. George T. Anderson', commanderId: 'hood', nodeId: 'warfield', strength: 1875, echelon: 4, hintTurn: 4, sectors: { emmitsburg_road: ['rose_woods', 'wheatfield'], flank_round_tops: ['devils_den'] } },
  // McLaws' Division (ordered by Longstreet directly)
  { id: 'kershaw', name: "Kershaw's Brigade", short: 'Kershaw', side: 'confederate', leader: 'Brig. Gen. Joseph B. Kershaw', commanderId: 'longstreet', nodeId: 'pitzer', strength: 2180, echelon: 5, hintTurn: 5, sectors: { emmitsburg_road: ['peach_orchard', 'rose_woods', 'wheatfield'], flank_round_tops: ['peach_orchard', 'rose_woods'] } },
  { id: 'semmes', name: "Semmes' Brigade", short: 'Semmes', side: 'confederate', leader: 'Brig. Gen. Paul J. Semmes', commanderId: 'longstreet', nodeId: 'pitzer', strength: 1335, echelon: 6, hintTurn: 5, sectors: { emmitsburg_road: ['peach_orchard', 'rose_woods', 'wheatfield'], flank_round_tops: ['peach_orchard', 'rose_woods'] } },
  { id: 'barksdale', name: "Barksdale's Brigade", short: 'Barksdale', side: 'confederate', leader: 'Brig. Gen. William Barksdale', commanderId: 'longstreet', nodeId: 'pitzer', strength: 1620, echelon: 7, hintTurn: 6, sectors: { emmitsburg_road: ['peach_orchard', 'trostle', 'cemetery_ridge_s'], flank_round_tops: ['peach_orchard'] } },
  { id: 'wofford', name: "Wofford's Brigade", short: 'Wofford', side: 'confederate', leader: 'Brig. Gen. William T. Wofford', commanderId: 'longstreet', nodeId: 'pitzer', strength: 1400, echelon: 8, hintTurn: 7, sectors: { emmitsburg_road: ['peach_orchard', 'wheatfield', 'plum_run'], flank_round_tops: ['peach_orchard'] } },
  // R. H. Anderson's Division (A. P. Hill's corps), released by Lee
  { id: 'wilcox', name: "Wilcox's Brigade", short: 'Wilcox', side: 'confederate', leader: 'Brig. Gen. Cadmus M. Wilcox', commanderId: 'lee', nodeId: 'seminary_c', strength: 1725, echelon: 9, hintTurn: 7, sectors: { emmitsburg_road: ['emmitsburg_rd', 'trostle', 'cemetery_ridge_s'], flank_round_tops: ['emmitsburg_rd'] } },
  { id: 'wright', name: "Wright's Brigade", short: 'Wright', side: 'confederate', leader: 'Brig. Gen. Ambrose R. Wright', commanderId: 'lee', nodeId: 'seminary_c', strength: 1415, echelon: 10, hintTurn: 7, sectors: { emmitsburg_road: ['emmitsburg_rd', 'cemetery_ridge_c'], flank_round_tops: ['emmitsburg_rd'] } },

  // III Corps
  { id: 'ward', name: "Ward's Brigade", short: 'Ward', side: 'union', leader: 'Brig. Gen. J. H. Hobart Ward', commanderId: 'sickles', nodeId: 'cemetery_ridge_s', strength: 2190, sectors: { advance_salient: ['plum_run', 'devils_den'], hold_ridge: ['little_round_top'] } },
  { id: 'de_trobriand', name: "de Trobriand's Brigade", short: 'de Trobriand', side: 'union', leader: 'Col. P. Regis de Trobriand', commanderId: 'sickles', nodeId: 'cemetery_ridge_s', strength: 1390, sectors: { advance_salient: ['plum_run', 'wheatfield'], hold_ridge: [] } },
  { id: 'graham', name: "Graham's Brigade", short: 'Graham', side: 'union', leader: 'Brig. Gen. Charles K. Graham', commanderId: 'sickles', nodeId: 'cemetery_ridge_s', strength: 1516, sectors: { advance_salient: ['trostle', 'peach_orchard'], hold_ridge: [] } },
  { id: 'carr', name: "Carr's Brigade", short: 'Carr', side: 'union', leader: 'Brig. Gen. Joseph B. Carr', commanderId: 'sickles', nodeId: 'cemetery_ridge_c', strength: 1715, sectors: { advance_salient: ['emmitsburg_rd'], hold_ridge: ['cemetery_ridge_s'] } },
  { id: 'brewster', name: 'Excelsior Brigade', short: 'Brewster', side: 'union', leader: 'Col. William R. Brewster', commanderId: 'sickles', nodeId: 'cemetery_ridge_c', strength: 1840, sectors: { advance_salient: ['emmitsburg_rd'], hold_ridge: ['cemetery_ridge_s'] } },
  // V Corps, answering Warren's call
  { id: 'vincent', name: "Vincent's Brigade", short: 'Vincent', side: 'union', leader: 'Col. Strong Vincent', commanderId: 'warren', nodeId: 'reserve', strength: 949, inReserve: true, hintTurn: 2, sectors: { call: ['little_round_top'] } },
  { id: 'maine20', name: '20th Maine', short: '20th Maine', side: 'union', leader: 'Col. Joshua L. Chamberlain', commanderId: 'warren', agentId: 'chamberlain', nodeId: 'reserve', strength: 386, ammo: 60, inReserve: true, hintTurn: 2, sectors: { call: ['little_round_top'] } },
  { id: 'weed', name: "Weed's Brigade", short: 'Weed', side: 'union', leader: 'Brig. Gen. Stephen H. Weed', commanderId: 'warren', nodeId: 'reserve', strength: 1485, inReserve: true, hintTurn: 4, sectors: { call: ['little_round_top'] } },
  // Reserves Meade feeds in
  { id: 'barnes', name: "Barnes's Division (Tilton, Sweitzer)", short: 'Barnes', side: 'union', leader: 'Brig. Gen. James Barnes', commanderId: 'meade', nodeId: 'reserve', strength: 2075, inReserve: true, hintTurn: 3, hintTarget: 'wheatfield', sectors: {} },
  { id: 'regulars', name: 'U.S. Regulars (Day, Burbank)', short: 'Regulars', side: 'union', leader: 'Brig. Gen. Romeyn B. Ayres', commanderId: 'meade', nodeId: 'reserve', strength: 2535, inReserve: true, hintTurn: 5, hintTarget: 'plum_run', sectors: {} },
  { id: 'mccandless', name: 'Pennsylvania Reserves', short: 'McCandless', side: 'union', leader: 'Col. William McCandless', commanderId: 'meade', nodeId: 'reserve', strength: 1245, inReserve: true, hintTurn: 7, hintTarget: 'plum_run', sectors: {} },
  { id: 'caldwell', name: "Caldwell's Division", short: 'Caldwell', side: 'union', leader: 'Brig. Gen. John C. Caldwell', commanderId: 'meade', nodeId: 'cemetery_ridge_c', strength: 3212, inReserve: true, hintTurn: 5, hintTarget: 'wheatfield', sectors: {} },
  { id: 'willard', name: "Willard's Brigade", short: 'Willard', side: 'union', leader: 'Col. George L. Willard', commanderId: 'meade', nodeId: 'cemetery_ridge_c', strength: 1510, inReserve: true, hintTurn: 6, hintTarget: 'trostle', sectors: {} },
  { id: 'minn1', name: '1st Minnesota', short: '1st Minn.', side: 'union', leader: 'Col. William Colvill', commanderId: 'meade', nodeId: 'cemetery_ridge_c', strength: 262, inReserve: true, hintTurn: 8, hintTarget: 'cemetery_ridge_s', sectors: {} },
];

/** Where Meade may send a reserve. */
export const RESERVE_TARGETS = ['little_round_top', 'plum_run', 'wheatfield', 'trostle', 'cemetery_ridge_s'];

export const OBJECTIVES = {
  emmitsburg_road: {
    label: 'Attack up the Emmitsburg Road',
    text: "Attack en echelon from the right, guiding the left by the Emmitsburg Road, envelop the enemy's left and drive it in.",
  },
  flank_round_tops: {
    label: 'Turn the Round Tops',
    text: "Move around the Round Tops, turn the enemy's left and strike his rear and trains.",
  },
  await: { label: 'Await developments', text: 'Hold the present line and await developments.' },
  hold_ridge: {
    label: 'Hold Cemetery Ridge',
    text: 'Prolong the line of the II Corps along Cemetery Ridge, your left resting on Little Round Top.',
  },
  advance_salient: {
    label: 'Advance to the Peach Orchard',
    text: "Advance the corps to the high ground along the Emmitsburg Road, the Peach Orchard and Devil's Den.",
  },
} as const;

/** The documented decisions the run is scored against. */
export const CHECKPOINTS = [
  { id: 'sickles_advance', label: 'Sickles and his orders', historicalLabel: 'Advances to the Peach Orchard on his own responsibility' },
  { id: 'lee_objective', label: "Lee's plan of attack", historicalLabel: 'Attack up the Emmitsburg Road' },
  { id: 'longstreet_obeys', label: "Longstreet and Lee's order", historicalLabel: 'Carries it out despite his objections' },
  { id: 'hood_protests', label: 'Hood and the Round Tops', historicalLabel: 'Protests and asks to move around the right' },
  { id: 'longstreet_denies', label: "Longstreet's ruling on Hood", historicalLabel: '"We must obey the orders of General Lee"' },
  { id: 'meade_supports', label: 'Meade finds Sickles forward', historicalLabel: 'Too late to withdraw; reinforces him' },
  { id: 'warren_rides', label: 'Warren and the left', historicalLabel: 'Rides to Little Round Top' },
  { id: 'warren_calls', label: 'Warren on the empty hill', historicalLabel: 'Sends at once for troops' },
  { id: 'vincent_answers', label: "Vincent and Warren's call", historicalLabel: 'Takes his brigade up without waiting for orders' },
  { id: 'chamberlain_charge', label: 'Chamberlain out of ammunition', historicalLabel: 'Orders the bayonet' },
];

/** Meade's council of war, evening of July 2 (OR 27/1 pp. 73-74). */
export const COUNCIL = [
  { name: 'John Gibbon', role: 'II Corps (acting)', note: 'Correct the position but do not retreat; in no condition to attack.' },
  { name: 'Alpheus S. Williams', role: 'XII Corps (acting)', note: 'A steady, practical division commander whose corps holds the right.' },
  { name: 'David B. Birney', role: 'III Corps (acting)', note: 'His corps was wrecked this afternoon; he calls it used up.' },
  { name: 'George Sykes', role: 'V Corps', note: 'A cautious regular whose corps saved the left today.' },
  { name: 'John Newton', role: 'I Corps', note: 'An engineer who thinks this a bad position, yet would correct it rather than leave it.' },
  { name: 'Oliver O. Howard', role: 'XI Corps', note: 'Would wait for the attack until tomorrow afternoon, and attack if it does not come.' },
  { name: 'Winfield S. Hancock', role: 'II Corps and left centre', note: 'The most aggressive of the corps commanders; will not give up the field.' },
  { name: 'John Sedgwick', role: 'VI Corps', note: 'Stolid and dependable; his large corps has just arrived after a forced march.' },
  { name: 'Henry W. Slocum', role: 'Right wing', note: 'Blunt and brief.' },
];
