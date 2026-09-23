{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs =
    {
      self,
      nixpkgs,
      systems,
    }:
    let
      eachSystem = nixpkgs.lib.genAttrs (import systems);
    in
    {
      devShells = eachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_latest
              pkgs.pnpm
              pkgs.biome
            ];
          };
        }
      );

      packages = eachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.stdenvNoCC.mkDerivation (finalAttrs: {
            pname = "app";
            version = "0.0.0";
            src = ./.;

            nativeBuildInputs = [
              pkgs.nodejs_latest
              pkgs.pnpm
              pkgs.pnpmConfigHook
              pkgs.pnpmBuildHook
            ];

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname version src;
              fetcherVersion = 4;
              hash = "sha256-ncWTUxe5e852i86n9twaQtecnuBLBUo12eMaP7i5Afw=";
            };

            installPhase = ''
              runHook preInstall
              cp -r dist $out
              runHook postInstall
            '';
          });
        }
      );
    };
}
