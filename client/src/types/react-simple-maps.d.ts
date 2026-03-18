declare module "react-simple-maps" {
  import { ReactNode, SVGProps } from "react";

  export interface ComposableMapProps {
    projectionConfig?: { scale?: number; center?: [number, number] };
    style?: React.CSSProperties;
    children?: ReactNode;
  }
  export function ComposableMap(props: ComposableMapProps): JSX.Element;

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: any[] }) => ReactNode;
  }
  export function Geographies(props: GeographiesProps): JSX.Element;

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: any;
    style?: { default?: object; hover?: object; pressed?: object };
  }
  export function Geography(props: GeographyProps): JSX.Element;

  export interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
  }
  export function Marker(props: MarkerProps): JSX.Element;
}
