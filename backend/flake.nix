{
  description = "Run 'nix develop' to have a dev shell that has everything this project needs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      devShell = pkgs.mkShell {
        buildInputs = with pkgs; [
          nodejs_20
          nodePackages.prisma
          openssl
        ];
        env = with pkgs; {
          # PRISMA_MIGRATION_ENGINE_BINARY = "${prisma-engines}/bin/migration-engine";
          PRISMA_QUERY_ENGINE_BINARY = "${prisma-engines}/bin/query-engine";
          PRISMA_QUERY_ENGINE_LIBRARY = "${prisma-engines}/lib/libquery_engine.node";
          PRISMA_INTROSPECTION_ENGINE_BINARY = "${prisma-engines}/bin/introspection-engine";
          PRISMA_FMT_BINARY = "${prisma-engines}/bin/prisma-fmt";
        };
      };
    });
}
