type IconNode = [tag: string, attrs: Record<string, string>];

function renderIcon(nodes: IconNode[], size = 48, color = 'currentColor'): string {
  const children = nodes
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${tag} ${attrStr}/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

// Lucide icon data
const CircleCheck: IconNode[] = [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'm9 12 2 2 4-4' }],
];

const CircleX: IconNode[] = [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'm15 9-6 6' }],
  ['path', { d: 'm9 9 6 6' }],
];

export const icons = {
  circleCheck: (size?: number, color?: string) => renderIcon(CircleCheck, size, color),
  circleX: (size?: number, color?: string) => renderIcon(CircleX, size, color),
};
