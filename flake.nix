{
  description = "LearnHarness - An agent harness for learning";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }: let
    systems = flake-utils.lib.defaultSystems;
  in
    flake-utils.lib.eachSystem systems (system: let
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfree = true;
      };
      lib = pkgs.lib;
      nodejs = pkgs.nodejs_24;
      electron = pkgs.electron_44;

      runtimeDeps = with pkgs; [
        nodejs
        electron
        git
      ];

      learnharnessLauncher = pkgs.writeShellScriptBin "learnharness" ''
        export ELECTRON_OVERRIDE_DIST_PATH="${electron}/bin"
        export ELECTRON_SKIP_BINARY_DOWNLOAD="1"
        export ELECTRON_OZONE_PLATFORM_HINT="auto"
        export PATH="${lib.makeBinPath runtimeDeps}:$PATH"

        if [ -f "package.json" ] && [ -f "electron/main.cjs" ]; then
          exec ${electron}/bin/electron . "$@"
        else
          echo "Please run learnharness from its repository directory or use packaged mode."
          exit 1
        fi
      '';

      learnharnessDevLauncher = pkgs.writeShellScriptBin "learnharness-dev" ''
        export ELECTRON_OVERRIDE_DIST_PATH="${electron}/bin"
        export ELECTRON_SKIP_BINARY_DOWNLOAD="1"
        export ELECTRON_OZONE_PLATFORM_HINT="auto"
        export PATH="${lib.makeBinPath runtimeDeps}:$PATH"

        exec npm run desktop:dev "$@"
      '';
    in {
      packages = {
        default = learnharnessLauncher;
        learnharness = learnharnessLauncher;
        dev = learnharnessDevLauncher;
      };

      apps = {
        default = {
          type = "app";
          program = "${learnharnessLauncher}/bin/learnharness";
        };
        dev = {
          type = "app";
          program = "${learnharnessDevLauncher}/bin/learnharness-dev";
        };
      };

      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs
          tsx
          electron
          pkg-config
        ];

        env = {
          ELECTRON_OVERRIDE_DIST_PATH = "${electron}/bin";
          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
          ELECTRON_OZONE_PLATFORM_HINT = "auto";
        };

        shellHook = ''
          export ELECTRON_OVERRIDE_DIST_PATH="${electron}/bin"
          export ELECTRON_SKIP_BINARY_DOWNLOAD="1"
          export ELECTRON_OZONE_PLATFORM_HINT="auto"
          export PATH="$PWD/node_modules/.bin:$PATH"
        '';
      };
    })
    // {
      homeManagerModules = {
        default = self.homeManagerModules.learnharness;
        learnharness = {
          config,
          lib,
          pkgs,
          ...
        }: let
          cfg = config.programs.learnharness;
          system = pkgs.stdenv.hostPlatform.system;
        in {
          options.programs.learnharness = {
            enable = lib.mkEnableOption "LearnHarness AI learning agent";
            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${system}.default;
              description = "The LearnHarness launcher package.";
            };
          };

          config = lib.mkIf cfg.enable {
            home.packages = [cfg.package];
          };
        };
      };
    };
}
