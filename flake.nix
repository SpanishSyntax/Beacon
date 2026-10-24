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

      desktopItem = pkgs.makeDesktopItem {
        name = "learnharness";
        desktopName = "LearnHarness";
        comment = "An agent harness for learning: adaptive teaching, practice, and a persistent knowledge graph";
        exec = "learnharness %U";
        icon = "learnharness";
        terminal = false;
        categories = ["Education" "Development"];
        startupWMClass = "LearnHarness";
      };

      learnharnessPackage = pkgs.stdenv.mkDerivation {
        pname = "learnharness";
        version = "0.3.4";
        src = lib.cleanSource ./.;

        nativeBuildInputs = [
          pkgs.copyDesktopItems
        ];

        desktopItems = [desktopItem];

        installPhase = ''
          runHook preInstall

          mkdir -p $out/bin
          mkdir -p $out/share/icons/hicolor/512x512/apps
          mkdir -p $out/share/icons/hicolor/scalable/apps

          if [ -f build/icon.png ]; then
            cp build/icon.png $out/share/icons/hicolor/512x512/apps/learnharness.png
          fi
          if [ -f build/icon-flat.svg ]; then
            cp build/icon-flat.svg $out/share/icons/hicolor/scalable/apps/learnharness.svg
          fi

          cat << 'EOF' > $out/bin/learnharness
          #!/usr/bin/env bash
          export ELECTRON_OVERRIDE_DIST_PATH="${electron}/bin"
          export ELECTRON_SKIP_BINARY_DOWNLOAD="1"
          export ELECTRON_OZONE_PLATFORM_HINT="auto"
          export PATH="${lib.makeBinPath runtimeDeps}:$PATH"

          if [ -f "package.json" ] && [ -f "electron/main.cjs" ]; then
            exec ${electron}/bin/electron . "$@"
          elif [ -n "$LEARNHARNESS_REPO" ] && [ -d "$LEARNHARNESS_REPO" ]; then
            cd "$LEARNHARNESS_REPO"
            exec ${electron}/bin/electron . "$@"
          else
            echo "LearnHarness launched outside a checkout directory."
            echo "Tip: run inside the learnharness directory or set LEARNHARNESS_REPO."
            exit 1
          fi
          EOF
          chmod +x $out/bin/learnharness

          cat << 'EOF' > $out/bin/learnharness-dev
          #!/usr/bin/env bash
          export ELECTRON_OVERRIDE_DIST_PATH="${electron}/bin"
          export ELECTRON_SKIP_BINARY_DOWNLOAD="1"
          export ELECTRON_OZONE_PLATFORM_HINT="auto"
          export PATH="${lib.makeBinPath runtimeDeps}:$PATH"

          if [ -n "$LEARNHARNESS_REPO" ] && [ -d "$LEARNHARNESS_REPO" ]; then
            cd "$LEARNHARNESS_REPO"
          fi
          exec npm run desktop:dev "$@"
          EOF
          chmod +x $out/bin/learnharness-dev

          runHook postInstall
        '';
      };
    in {
      packages = {
        default = learnharnessPackage;
        learnharness = learnharnessPackage;
        dev = learnharnessPackage;
      };

      apps = {
        default = {
          type = "app";
          program = "${learnharnessPackage}/bin/learnharness";
        };
        dev = {
          type = "app";
          program = "${learnharnessPackage}/bin/learnharness-dev";
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
