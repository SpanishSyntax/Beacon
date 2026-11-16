{
  description = "Beacon - An agent harness for learning";

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

      beaconDesktopItem = pkgs.makeDesktopItem {
        name = "beacon";
        desktopName = "Beacon";
        comment = "An agent harness for learning: adaptive teaching, practice, and a persistent knowledge graph";
        exec = "beacon %U";
        icon = "beacon";
        terminal = false;
        categories = ["Education" "Development"];
        startupWMClass = "Beacon";
      };

      beaconPackage = pkgs.buildNpmPackage {
        pname = "beacon";
        version = "0.3.4";
        src = lib.cleanSource ./.;

        npmDepsHash = "sha256-pziw5ud2QuqX3eMQKFNP5jG4xtNUl5jtiVeavlG1Cic=";

        nativeBuildInputs = [
          pkgs.copyDesktopItems
        ];

        desktopItems = [desktopItem beaconDesktopItem];

        env = {
          NEXT_TELEMETRY_DISABLED = "1";
          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
        };

        postBuild = ''
          node scripts/build-server.mjs
        '';

        installPhase = ''
          runHook preInstall

          mkdir -p $out/bin
          mkdir -p $out/lib/beacon
          mkdir -p $out/share/icons/hicolor/512x512/apps
          mkdir -p $out/share/icons/hicolor/scalable/apps

          if [ -f build/icon.png ]; then
            cp build/icon.png $out/share/icons/hicolor/512x512/apps/learnharness.png
            cp build/icon.png $out/share/icons/hicolor/512x512/apps/beacon.png
          fi
          if [ -f build/icon-flat.svg ]; then
            cp build/icon-flat.svg $out/share/icons/hicolor/scalable/apps/learnharness.svg
            cp build/icon-flat.svg $out/share/icons/hicolor/scalable/apps/beacon.svg
          fi

          # Copy standalone server payload
          cp -r .next/standalone $out/lib/beacon/server

          # Copy electron entrypoint
          cp -r electron $out/lib/beacon/electron
          cp package.json $out/lib/beacon/package.json

          cat << EOF > $out/bin/beacon
          #!/usr/bin/env bash
          export NODE_BIN="${nodejs}/bin/node"
          export LH_SERVER_ENTRY="$out/lib/beacon/server/server.js"
          export ELECTRON_OVERRIDE_DIST_PATH="${electron}/bin"
          export ELECTRON_SKIP_BINARY_DOWNLOAD="1"
          export ELECTRON_OZONE_PLATFORM_HINT="auto"
          export PATH="${lib.makeBinPath runtimeDeps}:\$PATH"

          exec ${electron}/bin/electron "$out/lib/beacon" "\$@"
          EOF
          chmod +x $out/bin/beacon

          cat << 'EOF' > $out/bin/beacon-dev
          #!/usr/bin/env bash
          export NODE_BIN="${nodejs}/bin/node"
          export ELECTRON_OVERRIDE_DIST_PATH="${electron}/bin"
          export ELECTRON_SKIP_BINARY_DOWNLOAD="1"
          export ELECTRON_OZONE_PLATFORM_HINT="auto"
          export PATH="${lib.makeBinPath runtimeDeps}:$PATH"

          CANDIDATES=(
            "$BEACON_REPO"
            "$LEARNHARNESS_REPO"
            "$PWD"
            "$HOME/Icebergs/Beacon"
            "$HOME/Documents/beacon"
            "$HOME/Workspace/beacon"
            "$HOME/Projects/beacon"
            "$HOME/Documents/learnharness"
            "$HOME/Workspace/learnharness"
            "$HOME/Projects/learnharness"
          )

          TARGET_DIR=""
          for candidate in "''${CANDIDATES[@]}"; do
            if [ -n "$candidate" ] && [ -f "$candidate/package.json" ] && [ -f "$candidate/electron/main.cjs" ]; then
              TARGET_DIR="$candidate"
              break
            fi
          done

          if [ -n "$TARGET_DIR" ]; then
            cd "$TARGET_DIR"
            exec npm run desktop:dev "$@"
          else
            echo "Error: Could not locate Beacon repository directory."
            exit 1
          fi
          EOF
          chmod +x $out/bin/beacon-dev

          ln -s $out/bin/beacon $out/bin/learnharness
          ln -s $out/bin/beacon-dev $out/bin/learnharness-dev

          runHook postInstall
        '';
      };
    in {
      packages = {
        default = beaconPackage;
        beacon = beaconPackage;
        learnharness = beaconPackage;
        dev = beaconPackage;
      };

      apps = {
        default = {
          type = "app";
          program = "${beaconPackage}/bin/beacon";
        };
        beacon = {
          type = "app";
          program = "${beaconPackage}/bin/beacon";
        };
        learnharness = {
          type = "app";
          program = "${beaconPackage}/bin/learnharness";
        };
        dev = {
          type = "app";
          program = "${beaconPackage}/bin/beacon-dev";
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
        default = self.homeManagerModules.beacon;
        beacon = {
          config,
          lib,
          pkgs,
          ...
        }: let
          cfg = config.programs.beacon;
          system = pkgs.stdenv.hostPlatform.system;
        in {
          options.programs.beacon = {
            enable = lib.mkEnableOption "Beacon AI learning agent";
            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${system}.default;
              description = "The Beacon launcher package.";
            };
          };

          config = lib.mkIf cfg.enable {
            home.packages = [cfg.package];
          };
        };
        learnharness = self.homeManagerModules.beacon;
      };
    };
}
