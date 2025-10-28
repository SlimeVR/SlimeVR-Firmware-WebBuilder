{
  description = "Node.js development environment with pnpm";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_24
            nodePackages.pnpm
          ];

          shellHook = ''
            echo "Node.js $(node --version)"
            echo "pnpm $(pnpm --version)"
            echo ""
            echo "Development environment ready!"
          '';
        };
      }
    );
}
