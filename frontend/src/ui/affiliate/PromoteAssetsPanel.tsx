import React from 'react';
export function PromoteAssetsPanel(){
  const PROMOTE_ASSETS_URL = 'https://www.notion.so/HirePilot-Affiliate-Partner-Links-Social-Media-Support-and-addons-2de8b3497efe80c1877fcd928849a40f?source=copy_link';
  const items=[{label:'Swipe Copy',desc:'Email & DM scripts'},{label:'Social Templates',desc:'Ready-made posts'},{label:'Promo Images',desc:'Branded assets'},{label:'Demo Deck',desc:'Presentation slides'}];
  return (
    <div className="card p-5">
      <h3 className="text-lg font-semibold mb-3">Promote HirePilot</h3>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(i=>(
          <a
            key={i.label}
            className="btn-outline text-left"
            href={PROMOTE_ASSETS_URL}
            target="_blank"
            rel="noreferrer"
          >
            <div className="font-medium">{i.label}</div>
            <div className="text-xs text-gray-500">{i.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}


