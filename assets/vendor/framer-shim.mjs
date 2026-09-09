/* WaveOps: substituto local do pacote "framer".

   Verificado em 09/09/2026: framer@2.4.1 e a unica versao que o esm.sh resolve e
   NAO exporta useIsStaticRenderer. O framer@3.0.4 resolve para "export default null",
   deixou de ser biblioteca. O pacote real e inutilizavel fora do canvas do Framer,
   entao os quatro simbolos que os componentes importam sao reimplementados aqui.

   Fora do editor do Framer, os controles de propriedade nao tem funcao: o componente
   recebe as props direto do nosso codigo de montagem. */

/** Registro de controles do editor. Sem editor, nao faz nada. */
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

/** Alvo de renderizacao. Sempre "preview": e o modo animado, nao o placeholder. */
export const RenderTarget = Object.freeze({
  canvas: 'CANVAS',
  export: 'EXPORT',
  thumbnail: 'THUMBNAIL',
  preview: 'PREVIEW',
  current() {
    return 'PREVIEW';
  },
});

/** Renderizador estatico e coisa de export do Framer. Aqui e sempre ao vivo. */
export function useIsStaticRenderer() {
  return false;
}
