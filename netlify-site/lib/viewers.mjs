export const ACTIVE_WINDOW=75000;
export const bucket=at=>Math.floor(at/60000);
export function viewerCounts(records,now=Date.now()) {
  const latest=new Map();
  for(const record of records) {
    if(!record || typeof record.session!=='string' || !Number.isFinite(record.at) || record.at>now || now-record.at>=ACTIVE_WINDOW)continue;
    if(!latest.has(record.session)||latest.get(record.session).at<record.at)latest.set(record.session,record);
  }
  const counts={};
  for(const record of latest.values())if(record.playing===true&&/^[a-f0-9]{24}$/.test(record.match||''))counts[record.match]=(counts[record.match]||0)+1;
  return counts;
}
