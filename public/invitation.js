export function invitation(peer,code){return 'gcg://'+new URL(peer).host+'/'+code}
export function parseInvitation(text){
 let u;try{u=new URL(String(text).trim())}catch{throw Error('ホストから受け取った招待情報を、そのまま貼り付けてください。')}
 if(u.protocol!=='gcg:'||u.username||u.password||u.search||u.hash||!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname)||u.hostname.split('.').some(x=>Number(x)>255)||!/^\/[A-Fa-f0-9]{12}$/.test(u.pathname)||!u.port||Number(u.port)<1024||Number(u.port)>65535)throw Error('招待情報の形式が違います。「招待をコピー」で取得した文字列を貼り付けてください。');
 return {peer:'http://'+u.host,code:u.pathname.slice(1).toUpperCase()};
}
