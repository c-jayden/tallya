import type { ReactElement, ReactNode } from 'react';

type PropsWithChildren = {
  children?: ReactNode;
  [key: string]: unknown;
};

export function collectText(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map((child) => collectText(child)).join('');
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (!node || typeof node !== 'object' || !('props' in node)) {
    return '';
  }

  const element = node as ReactElement<PropsWithChildren>;

  return collectText(element.props.children);
}

export function findElements(
  node: ReactNode,
  predicate: (element: ReactElement<PropsWithChildren>) => boolean,
): ReactElement<PropsWithChildren>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findElements(child, predicate));
  }

  if (!node || typeof node !== 'object' || !('props' in node)) {
    return [];
  }

  const element = node as ReactElement<PropsWithChildren>;
  const self = predicate(element) ? [element] : [];
  const children = element.props.children;

  if (Array.isArray(children)) {
    return [
      ...self,
      ...children.flatMap((child) => findElements(child, predicate)),
    ];
  }

  return [...self, ...findElements(children, predicate)];
}
