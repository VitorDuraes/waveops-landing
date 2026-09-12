/* WaveOps: substituto local do pacote "framer".

   Verificado em 09/09/2026: framer@2.4.1 é a única versão que o esm.sh resolve e
   NÃO exporta useIsStaticRenderer. O framer@3.0.4 resolve para "export default null",
   deixou de ser biblioteca. O pacote real é inutilizável fora do canvas do Framer,
   então os quatro símbolos que os componentes importam são reimplementados aqui.

   Fora do editor do Framer, os controles de propriedade não têm função: o componente
   recebe as props direto do nosso código de montagem. */

/** Registro de controles do editor. Sem editor, não faz nada. */
export function addPropertyControls() {}

/** Constantes que os componentes referenciam ao declarar controles. */
export const ControlType = Object.freeze({
  Boolean: 'boolean',
  Number: 'number',
  String: 'string',
  Color: 'color',
  Enum: 'enum',
  SegmentedEnum: 'segmentedenum',
  Array: 'array',
  Object: 'object',
  Image: 'image',
  ResponsiveImage: 'responsiveimage',
  File: 'file',
  Link: 'link',
  ComponentInstance: 'componentinstance',
  Transition: 'transition',
  EventHandler: 'eventhandler',
  Date: 'date',
  Padding: 'padding',
  BorderRadius: 'borderradius',
  Border: 'border',
  BoxShadow: 'boxshadow',
  FusedNumber: 'fusednumber',
});

/** Alvo de renderização. Sempre "preview": é o modo animado, não o placeholder. */
export const RenderTarget = Object.freeze({
  canvas: 'CANVAS',
  export: 'EXPORT',
  thumbnail: 'THUMBNAIL',
  preview: 'PREVIEW',
  current() {
    return 'PREVIEW';
  },
});

/** Renderizador estático é coisa de export do Framer. Aqui é sempre ao vivo. */
export function useIsStaticRenderer() {
  return false;
}
