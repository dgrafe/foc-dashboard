// Internationalization data and pure helpers. No DOM or storage side effects are required,
// so every module (and the Node test suite) can call t() safely.
//
// Key convention: dotted lowercase namespaced keys (e.g. "app.noDatasets"). Every key literal
// must appear either inside a t("…") call in js/ or in a data-i18n* attribute in index.html;
// tests/i18n.test.js enforces that the dictionary and its usage stay in sync.

export const DEFAULT_LANGUAGE = "en";

const LOCALE_TAGS = { en: "en-US", de: "de-DE", es: "es-ES", fr: "fr-FR", zh: "zh-CN" };

const LANGUAGE_NAMES = { en: "English", de: "Deutsch", es: "Español", fr: "Français", zh: "中文" };

const STORAGE_KEY = "foc_language";

export const translations = {
    en: {
        "meta.title": "Filecoin Onchain Cloud Dashboard",
        "meta.description": "Look up FEVM addresses or ENS names to inspect Filecoin Warm Storage datasets, pieces, CAR roots, wallet balances and Filecoin Pay runway.",

        "main.eyebrow": "Filecoin Onchain Cloud",
        "main.title": "Hosted data overview.",
        "main.intro": "Look up datasets for an FEVM address or ENS name, inspect stored Pieces, and view their corresponding IPFS root CIDs.",

        "form.walletAddressLabel": "FEVM address (0x, f410, t410) or ENS name",
        "form.addressPlaceholder": "0x…, f410… or name.eth",
        "form.addressHint": "Enter a 0x, f410 or t410 address, or an ENS name. ENS names are resolved on Ethereum Mainnet; only public read calls are made.",
        "form.fetchBtn": "Look up address or ENS",
        "form.networkSwitchLabel": "Filecoin network",

        "network.mainnet": "Mainnet",
        "network.calibration": "Calibration",

        "app.loadingData": "Loading data …",
        "app.resolvingEns": "Resolving ENS …",
        "app.preparing": "Preparing address lookup …",
        "app.ensName": "ENS name",
        "app.resolvingName": "Resolving :name on Ethereum Mainnet …",
        "app.readingDatasets": "Reading datasets from :network and loading piece lists …",
        "app.noDatasets": "No FWSS datasets were found for this address.",
        "app.requestFailed": "Request failed: :error. Check the RPC connection or whether the provider allows browser requests (CORS).",

        "results.emptyState": "Enter a FEVM address or ENS name to view its datasets and pieces.",
        "results.storedDatasets": "Stored datasets",
        "results.datasetsOne": ":count Dataset",
        "results.datasetsMany": ":count Datasets",
        "results.progress": ":label · loading :ready/:total ready · CAR roots :rootsDone/:rootsTotal",
        "results.progressLabel": "Loading datasets and CAR roots",

        "account.title": "Balances and storage runway",
        "account.subtitle": "Wallet and Filecoin Pay",
        "account.walletBalances": "Wallet balances",
        "account.filBalance": "FIL balance",
        "account.usdfcBalance": "USDFC in wallet",
        "account.filecoinPayStorage": "Filecoin Pay storage",
        "account.prediction": "Prediction",
        "account.storageRunway": "Storage runway",
        "account.totalMonthlyCost": "Total monthly storage cost",
        "account.monthlyCostTooltip": "Current Filecoin Pay rate across active payment rails, expressed per 86,400 epochs.",
        "account.accountDeposits": "Account deposits",
        "account.totalAmount": "Total amount",
        "account.availableForWithdrawal": "Available for withdrawal",
        "account.amountLocked": "Amount locked",
        "account.payHint": "Filecoin Pay amounts are denominated in USDFC; available funds exclude amounts locked by active rails. FIL is required for transaction fees. Monthly storage cost reflects active rail rates; usage-based egress and one-time operation fees can vary separately.",
        "account.loading": "Loading …",
        "account.unavailable": "Unavailable",

        "unit.usdfcPerMonth": ":value USDFC/mo",
        "cost.storageTerminated": "storage terminated",
        "cost.unavailable": "monthly cost unavailable",

        "format.noStorageSpend": "No active storage spend",
        "format.inDeficit": "In deficit · top-up required",
        "format.zeroRunway": "0 days · top-up required",
        "format.zeroDays": "0 days",
        "format.veryLongRunway": "Very long runway",
        "format.durationDays": ":days days :hours hr",
                "format.durationDaysOne": ":days day :hours hr",
                "format.durationHours": ":hours hr",
                "format.durationHoursOne": ":hours hr",
                "format.untilApprox": "until approx. :date",

                "lookup.emptyInput": "Enter a 0x, f410, or t410 address, or an ENS name.",
                "lookup.invalidAddress": "Enter a valid 0x address with 40 hexadecimal characters.",
                "lookup.conversionUnavailable": "Filecoin address conversion is unavailable.",
                "lookup.invalidFilecoinAddress": "Enter a valid f410 or t410 Filecoin address.",
                "lookup.resolveFailed": "Could not resolve name.",

        "dataset.title": "Dataset: :id",
        "dataset.storageProvider": "Storage Provider: :address",
        "dataset.providerEndpoint": "Provider Endpoint: ",
        "dataset.paymentRail": "Payment Rail: ",
        "dataset.railTooltip": "Open payment rail on Filecoin Pay",
        "dataset.providerTooltip": "Open provider entry on PDP Explorer",
        "dataset.checking": "Checking …",
        "dataset.active": "Active",
        "dataset.inactive": "Inactive",
        "dataset.ipfsIndexing": "IPFS Indexing",
        "dataset.cdn": "CDN",
        "dataset.piecesLoading": "Pieces: Loading …",
        "dataset.piecesUnavailable": "Pieces: Unavailable",
        "dataset.sizeAtLeast": "At Least :size",
        "dataset.badge": "Pieces: :count · Size: :size · Cost: :cost",
        "dataset.badgePartial": "Pieces: :count · Size: :size · Cost: :cost · Partial",
        "dataset.costTooltip": "Current Filecoin Pay PDP rail rate, expressed per 86,400 epochs.",
        "dataset.sizeUnknownNoteOne": " Size unavailable for :count piece.",
        "dataset.sizeUnknownNoteMany": " Size unavailable for :count pieces.",
        "dataset.emptyPieces": "No active pieces in this dataset.",
        "dataset.displayLimited": "Display limited to :count pieces.",
        "dataset.pieceQueryFailed": "Piece query failed: :error",

        "piece.sizeUnavailable": "size unavailable",
        "piece.cidLabel": "Piece CID:",
        "piece.copyCid": "Copy Piece CID to clipboard",
        "piece.copyRoot": "Copy CAR root CID to clipboard",
        "piece.copyReference": "Dataset :dataset · PieceID :piece",
        "piece.copyInLabel": "Copy in ",
        "piece.copiesInLabel": "Copies in ",
        "piece.moreCopies": "(+:count more)",
        "piece.downloadCdn": "Download from CDN",
        "piece.downloadProvider": "Download from storage provider",
        "piece.sourceProvider": "Provider",
        "piece.largeCar": "Large CAR · :size",
        "piece.largeCarTooltip": "This download is a CAR file of about :size. Check your connection and available disk space before starting.",
        "piece.rootPending": "CAR root pending …",
        "piece.readingHeader": "Reading CAR header …",
        "piece.rootPrefix": "CAR root: ",
        "piece.rootReadFrom": "Read from :source",
        "piece.rootUnavailable": "CAR root unavailable: :error",
        "piece.openRoot": "Open CAR root :root on inbrowser.link",
        "piece.fileTreeSummary": "Load UnixFS file tree",
        "piece.fileTreeLoading": "Reading CAR directory blocks …",
        "piece.fileTreeUnavailable": "File tree unavailable: :error",
        "piece.showNext": "Show next :count (:remaining more)",
        "piece.showAll": "Show all",

        "ui.copied": "Copied",
        "ui.copyFailed": "Could not copy",

        "car.providerSource": "Storage provider",
        "car.cdnSourceFallback": "FilBeam · provider unavailable",
        "car.noPdpEndpoint": "no PDP endpoint registered",
        "car.cdnDisabled": "CDN is not enabled.",
        "car.failureNoCdn": "Storage provider: :provider; :cdn",
        "car.providerThenCdn": "Provider: :provider; CDN: :cdn",
        "car.cdnFailure": "CDN: :error",
        "car.noSources": "No provider or CDN endpoint is available.",
        "car.scanExceeded": "CAR scan exceeds :size; display stopped for safety.",
        "car.noCarStream": "The browser cannot read the CAR stream.",
        "car.noPieceStream": "The browser cannot read the piece stream.",
        "car.onlyCarV1V2": "Only CARv1 and CARv2 are supported.",
        "car.noRoot": "CAR contains no root CID.",
        "car.tooManyNodes": "UnixFS tree exceeds :count nodes.",

        "tree.summary": "UnixFS · :source · :count nodes read",
        "tree.summaryOne": "UnixFS · :source · :count node read",
        "tree.dirEntry": ":name/ · Directory",
        "tree.depthLimit": "Deeper levels are not shown.",
        "tree.fileEntry": " · File · :size",
        "tree.kindDirectory": "Directory",
        "tree.kindFile": "File",
        "tree.kindEntry": "UnixFS entry",
        "tree.kindSymlink": "Symlink",
        "tree.kindMetadata": "Metadata",
        "tree.kindMissing": "Block missing from CAR",
        "tree.kindUnsupported": "Unrecognized UnixFS type",
        "tree.root": "Root",
        "tree.rootFile": "Root file",
        "tree.rootNumber": "Root :number",

        "chain.tooManyDatasets": "The account has more than :count datasets; stopped for safety.",

        "footer.version": "Version :version",
        "footer.github": "GitHub",
        "footer.githubTooltip": "Open the project on GitHub",
        "footer.languageLabel": "Language"
    },

    de: {
        "meta.title": "Filecoin Onchain Cloud-Dashboard",
        "meta.description": "Suchen Sie nach FEVM-Adressen oder ENS-Namen, um Filecoin Warm Storage-Datensätze, Pieces, CAR-Wurzeln, Wallet-Balances und Filecoin Pay-Laufzeit zu überprüfen.",

        "main.eyebrow": "Filecoin Onchain Cloud",
        "main.title": "Übersicht über gehostete Daten.",
        "main.intro": "Überprüfen Sie Datensätze für eine FEVM-Adresse oder einen ENS-Namen, inspizieren Sie gespeicherte Pieces und sehen Sie ihre entsprechenden IPFS Root CIDs.",

        "form.walletAddressLabel": "FEVM-Adresse (0x, f410, t410) oder ENS-Name",
        "form.addressPlaceholder": "0x…, f410… oder name.eth",
        "form.addressHint": "Geben Sie eine 0x-, f410- oder t410-Adresse oder einen ENS-Namen ein. ENS-Namen werden auf Ethereum Mainnet aufgelöst; nur öffentliche Leseaufrufe werden durchgeführt.",
        "form.fetchBtn": "Adresse oder ENS überprüfen",
        "form.networkSwitchLabel": "Filecoin-Netzwerk",

        "network.mainnet": "Mainnet",
        "network.calibration": "Kalibrierung",

        "app.loadingData": "Daten werden geladen …",
        "app.resolvingEns": "ENS wird aufgelöst …",
        "app.preparing": "Adressabfrage wird vorbereitet …",
        "app.ensName": "ENS-Name",
        "app.resolvingName": ":name wird auf Ethereum Mainnet aufgelöst …",
        "app.readingDatasets": "Datensätze von :network werden gelesen und Piece-Listen geladen …",
        "app.noDatasets": "Für diese Adresse wurden keine FWSS-Datensätze gefunden.",
        "app.requestFailed": "Anfrage fehlgeschlagen: :error. Prüfen Sie die RPC-Verbindung oder ob der Provider Browseranfragen (CORS) erlaubt.",

        "results.emptyState": "Geben Sie eine FEVM-Adresse oder einen ENS-Namen ein, um deren Datensätze und Pieces anzuzeigen.",
        "results.storedDatasets": "Gespeicherte Datensätze",
        "results.datasetsOne": ":count Datensatz",
        "results.datasetsMany": ":count Datensätze",
        "results.progress": ":label · lädt :ready/:total bereit · CAR-Wurzeln :rootsDone/:rootsTotal",
        "results.progressLabel": "Datensätze und CAR-Wurzeln werden geladen",

        "account.title": "Balances und Speicherlaufzeit",
        "account.subtitle": "Wallet und Filecoin Pay",
        "account.walletBalances": "Wallet-Balances",
        "account.filBalance": "FIL-Balance",
        "account.usdfcBalance": "USDFC im Wallet",
        "account.filecoinPayStorage": "Filecoin Pay-Speicher",
        "account.prediction": "Prognose",
        "account.storageRunway": "Speicherlaufzeit",
        "account.totalMonthlyCost": "Gesamte monatliche Speicherkosten",
        "account.monthlyCostTooltip": "Aktueller Filecoin-Pay-Satz über aktive Zahlungs-Rails, ausgedrückt pro 86.400 Epochen.",
        "account.accountDeposits": "Kontodepositen",
        "account.totalAmount": "Gesamtsumme",
        "account.availableForWithdrawal": "Verfügbar für Abhebung",
        "account.amountLocked": "Gesperrter Betrag",
        "account.payHint": "Filecoin Pay-Beträge sind in USDFC denominiert; verfügbare Mittel schließen Beträge aus, die durch aktive Rails gesperrt sind. FIL ist für Transaktionsgebühren erforderlich. Monatliche Speicherkosten spiegeln aktive Rail-Raten wider; nutzungsbasierte Egress- und einmalige Betriebsgebühren können separat variieren.",
        "account.loading": "Laden …",
        "account.unavailable": "Nicht verfügbar",

        "unit.usdfcPerMonth": ":value USDFC/Monat",
        "cost.storageTerminated": "Speicher beendet",
        "cost.unavailable": "Monatskosten nicht verfügbar",

        "format.noStorageSpend": "Keine aktive Speicherausgabe",
        "format.inDeficit": "Im Defizit · Nachfüllen erforderlich",
        "format.zeroRunway": "0 Tage · Nachfüllen erforderlich",
        "format.zeroDays": "0 Tage",
        "format.veryLongRunway": "Sehr lange Laufzeit",
        "format.durationDays": ":days Tage :hours Std.",
                "format.durationDaysOne": ":days Tag :hours Std.",
                "format.durationHours": ":hours Std.",
                "format.durationHoursOne": ":hours Std.",
                "format.untilApprox": "bis ca. :date",

                "lookup.emptyInput": "Geben Sie eine 0x-, f410- oder t410-Adresse oder einen ENS-Namen ein.",
                "lookup.invalidAddress": "Geben Sie eine gültige 0x-Adresse mit 40 hexadezimalen Zeichen ein.",
                "lookup.conversionUnavailable": "Die Filecoin-Adresskonvertierung ist nicht verfügbar.",
                "lookup.invalidFilecoinAddress": "Geben Sie eine gültige f410- oder t410-Filecoin-Adresse ein.",
                "lookup.resolveFailed": "Name konnte nicht aufgelöst werden.",

        "dataset.title": "Datensatz: :id",
        "dataset.storageProvider": "Speicheranbieter: :address",
        "dataset.providerEndpoint": "Anbieter-Endpunkt: ",
        "dataset.paymentRail": "Zahlungs-Rail: ",
        "dataset.railTooltip": "Zahlungs-Rail auf Filecoin Pay öffnen",
        "dataset.providerTooltip": "Anbieter-Eintrag im PDP Explorer öffnen",
        "dataset.checking": "Wird geprüft …",
        "dataset.active": "Aktiv",
        "dataset.inactive": "Inaktiv",
        "dataset.ipfsIndexing": "IPFS-Indexierung",
        "dataset.cdn": "CDN",
        "dataset.piecesLoading": "Pieces: Laden …",
        "dataset.piecesUnavailable": "Pieces: Nicht verfügbar",
        "dataset.sizeAtLeast": "Mindestens :size",
        "dataset.badge": "Pieces: :count · Größe: :size · Kosten: :cost",
        "dataset.badgePartial": "Pieces: :count · Größe: :size · Kosten: :cost · Teilweise",
        "dataset.costTooltip": "Aktueller Filecoin-Pay-PDP-Rail-Satz, ausgedrückt pro 86.400 Epochen.",
        "dataset.sizeUnknownNoteOne": " Größe für :count Piece nicht verfügbar.",
        "dataset.sizeUnknownNoteMany": " Größe für :count Pieces nicht verfügbar.",
        "dataset.emptyPieces": "Keine aktiven Pieces in diesem Datensatz.",
        "dataset.displayLimited": "Anzeige auf :count Pieces begrenzt.",
        "dataset.pieceQueryFailed": "Piece-Abfrage fehlgeschlagen: :error",

        "piece.sizeUnavailable": "Größe nicht verfügbar",
        "piece.cidLabel": "Piece-CID:",
        "piece.copyCid": "Piece-CID in Zwischenablage kopieren",
        "piece.copyRoot": "CAR-Wurzel-CID in Zwischenablage kopieren",
        "piece.copyReference": "Datensatz :dataset · PieceID :piece",
        "piece.copyInLabel": "Kopie in ",
        "piece.copiesInLabel": "Kopien in ",
        "piece.moreCopies": "(+:count weitere)",
        "piece.downloadCdn": "Von CDN herunterladen",
        "piece.downloadProvider": "Vom Speicheranbieter herunterladen",
        "piece.sourceProvider": "Anbieter",
        "piece.largeCar": "Großes CAR · :size",
        "piece.largeCarTooltip": "Dieser Download ist eine CAR-Datei von etwa :size. Prüfen Sie vor dem Start Ihre Verbindung und den verfügbaren Speicherplatz.",
        "piece.rootPending": "CAR-Wurzel ausstehend …",
        "piece.readingHeader": "CAR-Header wird gelesen …",
        "piece.rootPrefix": "CAR-Wurzel: ",
        "piece.rootReadFrom": "Gelesen von :source",
        "piece.rootUnavailable": "CAR-Wurzel nicht verfügbar: :error",
        "piece.openRoot": "CAR-Wurzel :root auf inbrowser.link öffnen",
        "piece.fileTreeSummary": "UnixFS-Dateibaum laden",
        "piece.fileTreeLoading": "CAR-Verzeichnisblöcke werden gelesen …",
        "piece.fileTreeUnavailable": "Dateibaum nicht verfügbar: :error",
        "piece.showNext": "Weitere :count anzeigen (:remaining verbleiben)",
        "piece.showAll": "Alle anzeigen",

        "ui.copied": "Kopiert",
        "ui.copyFailed": "Kopieren fehlgeschlagen",

        "car.providerSource": "Speicheranbieter",
        "car.cdnSourceFallback": "FilBeam · Anbieter nicht verfügbar",
        "car.noPdpEndpoint": "kein PDP-Endpunkt registriert",
        "car.cdnDisabled": "CDN ist nicht aktiviert.",
        "car.failureNoCdn": "Speicheranbieter: :provider; :cdn",
        "car.providerThenCdn": "Anbieter: :provider; CDN: :cdn",
        "car.cdnFailure": "CDN: :error",
        "car.noSources": "Es ist kein Provider- oder CDN-Endpunkt verfügbar.",
        "car.scanExceeded": "CAR-Scan überschreitet :size; Anzeige aus Sicherheitsgründen gestoppt.",
        "car.noCarStream": "Der Browser kann den CAR-Stream nicht lesen.",
        "car.noPieceStream": "Der Browser kann den Piece-Stream nicht lesen.",
        "car.onlyCarV1V2": "Nur CARv1 und CARv2 werden unterstützt.",
        "car.noRoot": "CAR enthält keine Root-CID.",
        "car.tooManyNodes": "UnixFS-Baum überschreitet :count Knoten.",

        "tree.summary": "UnixFS · :source · :count Knoten gelesen",
        "tree.summaryOne": "UnixFS · :source · :count Knoten gelesen",
        "tree.dirEntry": ":name/ · Verzeichnis",
        "tree.depthLimit": "Tiefere Ebenen werden nicht angezeigt.",
        "tree.fileEntry": " · Datei · :size",
        "tree.kindDirectory": "Verzeichnis",
        "tree.kindFile": "Datei",
        "tree.kindEntry": "UnixFS-Eintrag",
        "tree.kindSymlink": "Symlink",
        "tree.kindMetadata": "Metadaten",
        "tree.kindMissing": "Block fehlt im CAR",
        "tree.kindUnsupported": "Unbekannter UnixFS-Typ",
        "tree.root": "Wurzel",
        "tree.rootFile": "Wurzeldatei",
        "tree.rootNumber": "Wurzel :number",

        "chain.tooManyDatasets": "Das Konto hat mehr als :count Datensätze; aus Sicherheitsgründen gestoppt.",

        "footer.version": "Version :version",
        "footer.github": "GitHub",
        "footer.githubTooltip": "Projekt auf GitHub öffnen",
        "footer.languageLabel": "Sprache"
    },

    es: {
        "meta.title": "Panel de Filecoin Onchain Cloud",
        "meta.description": "Busque direcciones FEVM o nombres ENS para inspeccionar conjuntos de datos, piezas, raíces CAR, saldos de billetera y pista de Filecoin Pay.",

        "main.eyebrow": "Filecoin Onchain Cloud",
        "main.title": "Vista general de datos alojados.",
        "main.intro": "Busque conjuntos de datos para una dirección FEVM o nombre ENS, inspeccione las piezas almacenadas y vea sus CIDs raíz IPFS correspondientes.",

        "form.walletAddressLabel": "Dirección FEVM (0x, f410, t410) o nombre ENS",
        "form.addressPlaceholder": "0x…, f410… o name.eth",
        "form.addressHint": "Ingrese una dirección 0x, f410 o t410, o un nombre ENS. Los nombres ENS se resuelven en Ethereum Mainnet; solo se realizan llamadas de lectura públicas.",
        "form.fetchBtn": "Buscar dirección o ENS",
        "form.networkSwitchLabel": "Red de Filecoin",

        "network.mainnet": "Mainnet",
        "network.calibration": "Calibración",

        "app.loadingData": "Cargando datos …",
        "app.resolvingEns": "Resolviendo ENS …",
        "app.preparing": "Preparando búsqueda de dirección …",
        "app.ensName": "nombre ENS",
        "app.resolvingName": "Resolviendo :name en Ethereum Mainnet …",
        "app.readingDatasets": "Leyendo conjuntos de datos de :network y cargando listas de piezas …",
        "app.noDatasets": "No se encontraron conjuntos de datos FWSS para esta dirección.",
        "app.requestFailed": "La solicitud falló: :error. Compruebe la conexión RPC o si el proveedor permite solicitudes del navegador (CORS).",

        "results.emptyState": "Ingrese una dirección FEVM o nombre ENS para ver sus conjuntos de datos y piezas.",
        "results.storedDatasets": "Conjuntos de datos almacenados",
        "results.datasetsOne": ":count conjunto de datos",
        "results.datasetsMany": ":count conjuntos de datos",
        "results.progress": ":label · cargando :ready/:total listas · raíces CAR :rootsDone/:rootsTotal",
        "results.progressLabel": "Cargando conjuntos de datos y raíces CAR",

        "account.title": "Saldos y pista de almacenamiento",
        "account.subtitle": "Billetera y Filecoin Pay",
        "account.walletBalances": "Saldos de billetera",
        "account.filBalance": "Saldo FIL",
        "account.usdfcBalance": "USDFC en billetera",
        "account.filecoinPayStorage": "Almacenamiento Filecoin Pay",
        "account.prediction": "Predicción",
        "account.storageRunway": "Pista de almacenamiento",
        "account.totalMonthlyCost": "Costo total de almacenamiento mensual",
        "account.monthlyCostTooltip": "Tasa actual de Filecoin Pay en los rails de pago activos, expresada por 86.400 épocas.",
        "account.accountDeposits": "Depósitos de cuenta",
        "account.totalAmount": "Monto total",
        "account.availableForWithdrawal": "Disponible para retiro",
        "account.amountLocked": "Monto bloqueado",
        "account.payHint": "Los montos de Filecoin Pay se denominan en USDFC; los fondos disponibles excluyen los montos bloqueados por rails activos. FIL es necesario para las tarifas de transacción. El costo mensual de almacenamiento refleja las tarifas activas del rail; el egress basado en uso y las tarifas de operación únicas pueden variar por separado.",
        "account.loading": "Cargando …",
        "account.unavailable": "No disponible",

        "unit.usdfcPerMonth": ":value USDFC/mes",
        "cost.storageTerminated": "almacenamiento terminado",
        "cost.unavailable": "costo mensual no disponible",

        "format.noStorageSpend": "Sin gasto activo de almacenamiento",
        "format.inDeficit": "En déficit · se requiere recarga",
        "format.zeroRunway": "0 días · se requiere recarga",
        "format.zeroDays": "0 días",
        "format.veryLongRunway": "Pista muy larga",
        "format.durationDays": ":days días :hours h",
                "format.durationDaysOne": ":days día :hours h",
                "format.durationHours": ":hours h",
                "format.durationHoursOne": ":hours h",
                "format.untilApprox": "hasta aprox. :date",

                "lookup.emptyInput": "Ingrese una dirección 0x, f410 o t410, o un nombre ENS.",
                "lookup.invalidAddress": "Ingrese una dirección 0x válida con 40 caracteres hexadecimales.",
                "lookup.conversionUnavailable": "La conversión de direcciones Filecoin no está disponible.",
                "lookup.invalidFilecoinAddress": "Ingrese una dirección Filecoin f410 o t410 válida.",
                "lookup.resolveFailed": "No se pudo resolver el nombre.",

        "dataset.title": "Conjunto de datos: :id",
        "dataset.storageProvider": "Proveedor de almacenamiento: :address",
        "dataset.providerEndpoint": "Endpoint del proveedor: ",
        "dataset.paymentRail": "Rail de pago: ",
        "dataset.railTooltip": "Abrir rail de pago en Filecoin Pay",
        "dataset.providerTooltip": "Abrir entrada del proveedor en PDP Explorer",
        "dataset.checking": "Comprobando …",
        "dataset.active": "Activo",
        "dataset.inactive": "Inactivo",
        "dataset.ipfsIndexing": "Indexación IPFS",
        "dataset.cdn": "CDN",
        "dataset.piecesLoading": "Piezas: Cargando …",
        "dataset.sizeAtLeast": "Al menos :size",
        "dataset.piecesUnavailable": "Piezas: No disponible",
        "dataset.badge": "Piezas: :count · Tamaño: :size · Coste: :cost",
        "dataset.badgePartial": "Piezas: :count · Tamaño: :size · Coste: :cost · Parcial",
        "dataset.costTooltip": "Tasa actual del rail PDP de Filecoin Pay, expresada por 86.400 épocas.",
        "dataset.sizeUnknownNoteOne": " Tamaño no disponible para :count pieza.",
        "dataset.sizeUnknownNoteMany": " Tamaño no disponible para :count piezas.",
        "dataset.emptyPieces": "No hay piezas activas en este conjunto de datos.",
        "dataset.displayLimited": "Visualización limitada a :count piezas.",
        "dataset.pieceQueryFailed": "Error en la consulta de piezas: :error",

        "piece.sizeUnavailable": "tamaño no disponible",
        "piece.cidLabel": "Piece CID:",
        "piece.copyCid": "Copiar Piece CID al portapapeles",
        "piece.copyRoot": "Copiar CID de raíz CAR al portapapeles",
        "piece.copyReference": "Conjunto :dataset · PieceID :piece",
        "piece.copyInLabel": "Copia en ",
        "piece.copiesInLabel": "Copias en ",
        "piece.moreCopies": "(+:count más)",
        "piece.downloadCdn": "Descargar desde CDN",
        "piece.downloadProvider": "Descargar desde el proveedor de almacenamiento",
        "piece.sourceProvider": "Proveedor",
        "piece.largeCar": "CAR grande · :size",
        "piece.largeCarTooltip": "Esta descarga es un archivo CAR de unos :size. Compruebe su conexión y el espacio disponible antes de empezar.",
        "piece.rootPending": "Raíz CAR pendiente …",
        "piece.readingHeader": "Leyendo cabecera CAR …",
        "piece.rootPrefix": "Raíz CAR: ",
        "piece.rootReadFrom": "Leído desde :source",
        "piece.rootUnavailable": "Raíz CAR no disponible: :error",
        "piece.openRoot": "Abrir raíz CAR :root en inbrowser.link",
        "piece.fileTreeSummary": "Cargar árbol de archivos UnixFS",
        "piece.fileTreeLoading": "Leyendo bloques de directorio CAR …",
        "piece.fileTreeUnavailable": "Árbol de archivos no disponible: :error",
        "piece.showNext": "Mostrar los siguientes :count (:remaining más)",
        "piece.showAll": "Mostrar todo",

        "ui.copied": "Copiado",
        "ui.copyFailed": "No se pudo copiar",

        "car.providerSource": "Proveedor de almacenamiento",
        "car.cdnSourceFallback": "FilBeam · proveedor no disponible",
        "car.noPdpEndpoint": "sin endpoint PDP registrado",
        "car.cdnDisabled": "CDN no está habilitado.",
        "car.failureNoCdn": "Proveedor de almacenamiento: :provider; :cdn",
        "car.providerThenCdn": "Proveedor: :provider; CDN: :cdn",
        "car.cdnFailure": "CDN: :error",
        "car.noSources": "No hay ningún endpoint de proveedor o CDN disponible.",
        "car.scanExceeded": "El análisis CAR supera :size; visualización detenida por seguridad.",
        "car.noCarStream": "El navegador no puede leer el flujo CAR.",
        "car.noPieceStream": "El navegador no puede leer el flujo de piezas.",
        "car.onlyCarV1V2": "Solo se admiten CARv1 y CARv2.",
        "car.noRoot": "El CAR no contiene ningún CID raíz.",
        "car.tooManyNodes": "El árbol UnixFS supera :count nodos.",

        "tree.summary": "UnixFS · :source · :count nodos leídos",
        "tree.summaryOne": "UnixFS · :source · :count nodo leído",
        "tree.dirEntry": ":name/ · Directorio",
        "tree.depthLimit": "Los niveles más profundos no se muestran.",
        "tree.fileEntry": " · Archivo · :size",
        "tree.kindDirectory": "Directorio",
        "tree.kindFile": "Archivo",
        "tree.kindEntry": "Entrada UnixFS",
        "tree.kindSymlink": "Enlace simbólico",
        "tree.kindMetadata": "Metadatos",
        "tree.kindMissing": "Bloque ausente del CAR",
        "tree.kindUnsupported": "Tipo UnixFS no reconocido",
        "tree.root": "Raíz",
        "tree.rootFile": "Archivo raíz",
        "tree.rootNumber": "Raíz :number",

        "chain.tooManyDatasets": "La cuenta tiene más de :count conjuntos de datos; detenido por seguridad.",

        "footer.version": "Versión :version",
        "footer.github": "GitHub",
        "footer.githubTooltip": "Abrir el proyecto en GitHub",
        "footer.languageLabel": "Idioma"
    },

    fr: {
        "meta.title": "Tableau de bord Filecoin Onchain Cloud",
        "meta.description": "Recherchez des adresses FEVM ou des noms ENS pour inspecter les ensembles de données, pièces, racines CAR, soldes de portefeuille et la durée de Filecoin Pay.",

        "main.eyebrow": "Filecoin Onchain Cloud",
        "main.title": "Aperçu des données hébergées.",
        "main.intro": "Recherchez des ensembles de données pour une adresse FEVM ou un nom ENS, inspectez les pièces stockées et consultez leurs CIDs racine IPFS correspondants.",

        "form.walletAddressLabel": "Adresse FEVM (0x, f410, t410) ou nom ENS",
        "form.addressPlaceholder": "0x…, f410… ou name.eth",
        "form.addressHint": "Entrez une adresse 0x, f410 ou t410, ou un nom ENS. Les noms ENS sont résolus sur Ethereum Mainnet; seuls les appels de lecture publics sont effectués.",
        "form.fetchBtn": "Rechercher l'adresse ou ENS",
        "form.networkSwitchLabel": "Réseau Filecoin",

        "network.mainnet": "Mainnet",
        "network.calibration": "Calibration",

        "app.loadingData": "Chargement des données …",
        "app.resolvingEns": "Résolution ENS …",
        "app.preparing": "Préparation de la recherche d'adresse …",
        "app.ensName": "nom ENS",
        "app.resolvingName": "Résolution de :name sur Ethereum Mainnet …",
        "app.readingDatasets": "Lecture des ensembles de données de :network et chargement des listes de pièces …",
        "app.noDatasets": "Aucun ensemble de données FWSS trouvé pour cette adresse.",
        "app.requestFailed": "La requête a échoué : :error. Vérifiez la connexion RPC ou si le fournisseur autorise les requêtes du navigateur (CORS).",

        "results.emptyState": "Entrez une adresse FEVM ou un nom ENS pour afficher ses ensembles de données et pièces.",
        "results.storedDatasets": "Ensembles de données stockés",
        "results.datasetsOne": ":count ensemble de données",
        "results.datasetsMany": ":count ensembles de données",
        "results.progress": ":label · chargement :ready/:total prêts · racines CAR :rootsDone/:rootsTotal",
        "results.progressLabel": "Chargement des ensembles de données et des racines CAR",

        "account.title": "Soldes et durée de stockage",
        "account.subtitle": "Portefeuille et Filecoin Pay",
        "account.walletBalances": "Soldes de portefeuille",
        "account.filBalance": "Solde FIL",
        "account.usdfcBalance": "USDFC dans le portefeuille",
        "account.filecoinPayStorage": "Stockage Filecoin Pay",
        "account.prediction": "Prévision",
        "account.storageRunway": "Durée de stockage",
        "account.totalMonthlyCost": "Coût total de stockage mensuel",
        "account.monthlyCostTooltip": "Taux Filecoin Pay actuel sur les rails de paiement actifs, exprimé par tranche de 86 400 époques.",
        "account.accountDeposits": "Dépôts de compte",
        "account.totalAmount": "Montant total",
        "account.availableForWithdrawal": "Disponible pour retrait",
        "account.amountLocked": "Montant verrouillé",
        "account.payHint": "Les montants Filecoin Pay sont dénommés en USDFC; les fonds disponibles excluent les montants verrouillés par des rails actifs. FIL est requis pour les frais de transaction. Le coût mensuel de stockage reflète les tarifs de rail actifs; l'egress basé sur l'utilisation et les frais d'exploitation uniques peuvent varier séparément.",
        "account.loading": "Chargement …",
        "account.unavailable": "Indisponible",

        "unit.usdfcPerMonth": ":value USDFC/mois",
        "cost.storageTerminated": "stockage terminé",
        "cost.unavailable": "coût mensuel indisponible",

        "format.noStorageSpend": "Aucune dépense de stockage active",
        "format.inDeficit": "En déficit · recharge requise",
        "format.zeroRunway": "0 jours · recharge requise",
        "format.zeroDays": "0 jours",
        "format.veryLongRunway": "Très longue durée",
        "format.durationDays": ":days jours :hours h",
                "format.durationDaysOne": ":days jour :hours h",
                "format.durationHours": ":hours h",
                "format.durationHoursOne": ":hours h",
                "format.untilApprox": "jusqu'à env. :date",

                "lookup.emptyInput": "Entrez une adresse 0x, f410 ou t410, ou un nom ENS.",
                "lookup.invalidAddress": "Entrez une adresse 0x valide avec 40 caractères hexadécimaux.",
                "lookup.conversionUnavailable": "La conversion d'adresses Filecoin n'est pas disponible.",
                "lookup.invalidFilecoinAddress": "Entrez une adresse Filecoin f410 ou t410 valide.",
                "lookup.resolveFailed": "Impossible de résoudre le nom.",

        "dataset.title": "Ensemble de données : :id",
        "dataset.storageProvider": "Fournisseur de stockage : :address",
        "dataset.providerEndpoint": "Point de terminaison du fournisseur : ",
        "dataset.paymentRail": "Rail de paiement : ",
        "dataset.railTooltip": "Ouvrir le rail de paiement sur Filecoin Pay",
        "dataset.providerTooltip": "Ouvrir la fiche du fournisseur sur PDP Explorer",
        "dataset.checking": "Vérification …",
        "dataset.active": "Actif",
        "dataset.inactive": "Inactif",
        "dataset.ipfsIndexing": "Indexation IPFS",
        "dataset.cdn": "CDN",
        "dataset.sizeAtLeast": "Au moins :size",
        "dataset.piecesLoading": "Pièces : Chargement …",
        "dataset.piecesUnavailable": "Pièces : Indisponible",
        "dataset.badge": "Pièces : :count · Taille : :size · Coût : :cost",
        "dataset.badgePartial": "Pièces : :count · Taille : :size · Coût : :cost · Partiel",
        "dataset.costTooltip": "Taux actuel du rail PDP Filecoin Pay, exprimé par tranche de 86 400 époques.",
        "dataset.sizeUnknownNoteOne": " Taille indisponible pour :count pièce.",
        "dataset.sizeUnknownNoteMany": " Taille indisponible pour :count pièces.",
        "dataset.emptyPieces": "Aucune pièce active dans cet ensemble de données.",
        "dataset.displayLimited": "Affichage limité à :count pièces.",
        "dataset.pieceQueryFailed": "La requête de pièces a échoué : :error",

        "piece.sizeUnavailable": "taille indisponible",
        "piece.cidLabel": "Piece CID:",
        "piece.copyCid": "Copier le Piece CID dans le presse-papiers",
        "piece.copyRoot": "Copier le CID de racine CAR dans le presse-papiers",
        "piece.copyReference": "Ensemble :dataset · PieceID :piece",
        "piece.copyInLabel": "Copie dans ",
        "piece.copiesInLabel": "Copies dans ",
        "piece.moreCopies": "(+:count de plus)",
        "piece.downloadCdn": "Télécharger depuis le CDN",
        "piece.downloadProvider": "Télécharger depuis le fournisseur de stockage",
        "piece.sourceProvider": "Fournisseur",
        "piece.largeCar": "Gros CAR · :size",
        "piece.largeCarTooltip": "Ce téléchargement est un fichier CAR d'environ :size. Vérifiez votre connexion et l'espace disque disponible avant de commencer.",
        "piece.rootPending": "Racine CAR en attente …",
        "piece.readingHeader": "Lecture de l'en-tête CAR …",
        "piece.rootPrefix": "Racine CAR : ",
        "piece.rootReadFrom": "Lu depuis :source",
        "piece.rootUnavailable": "Racine CAR indisponible : :error",
        "piece.openRoot": "Ouvrir la racine CAR :root sur inbrowser.link",
        "piece.fileTreeSummary": "Charger l'arborescence UnixFS",
        "piece.fileTreeLoading": "Lecture des blocs de répertoire CAR …",
        "piece.fileTreeUnavailable": "Arborescence indisponible : :error",
        "piece.showNext": "Afficher les :count suivants (:remaining restants)",
        "piece.showAll": "Tout afficher",

        "ui.copied": "Copié",
        "ui.copyFailed": "Échec de la copie",

        "car.providerSource": "Fournisseur de stockage",
        "car.cdnSourceFallback": "FilBeam · fournisseur indisponible",
        "car.noPdpEndpoint": "aucun point de terminaison PDP enregistré",
        "car.cdnDisabled": "Le CDN n'est pas activé.",
        "car.failureNoCdn": "Fournisseur de stockage : :provider ; :cdn",
        "car.providerThenCdn": "Fournisseur : :provider ; CDN : :cdn",
        "car.cdnFailure": "CDN : :error",
        "car.noSources": "Aucun point de terminaison fournisseur ou CDN disponible.",
        "car.scanExceeded": "L'analyse CAR dépasse :size ; affichage arrêté par sécurité.",
        "car.noCarStream": "Le navigateur ne peut pas lire le flux CAR.",
        "car.noPieceStream": "Le navigateur ne peut pas lire le flux de pièces.",
        "car.onlyCarV1V2": "Seuls CARv1 et CARv2 sont pris en charge.",
        "car.noRoot": "Le CAR ne contient pas de CID racine.",
        "car.tooManyNodes": "L'arborescence UnixFS dépasse :count nœuds.",

        "tree.summary": "UnixFS · :source · :count nœuds lus",
        "tree.summaryOne": "UnixFS · :source · :count nœud lu",
        "tree.dirEntry": ":name/ · Répertoire",
        "tree.depthLimit": "Les niveaux plus profonds ne sont pas affichés.",
        "tree.fileEntry": " · Fichier · :size",
        "tree.kindDirectory": "Répertoire",
        "tree.kindFile": "Fichier",
        "tree.kindEntry": "Entrée UnixFS",
        "tree.kindSymlink": "Lien symbolique",
        "tree.kindMetadata": "Métadonnées",
        "tree.kindMissing": "Bloc manquant dans le CAR",
        "tree.kindUnsupported": "Type UnixFS non reconnu",
        "tree.root": "Racine",
        "tree.rootFile": "Fichier racine",
        "tree.rootNumber": "Racine :number",

        "chain.tooManyDatasets": "Le compte a plus de :count ensembles de données ; arrêt par sécurité.",

        "footer.version": "Version :version",
        "footer.github": "GitHub",
        "footer.githubTooltip": "Ouvrir le projet sur GitHub",
        "footer.languageLabel": "Langue"
    },

    zh: {
        "meta.title": "Filecoin Onchain Cloud 数据面板",
        "meta.description": "查询 FEVM 地址或 ENS 名称，查看 Filecoin Warm Storage 数据集、Piece、CAR 根、钱包余额和 Filecoin Pay 运行时间。",

        "main.eyebrow": "Filecoin Onchain Cloud",
        "main.title": "托管数据概览。",
        "main.intro": "查询 FEVM 地址或 ENS 名称的数据集，查看已存储的 Piece 及其对应的 IPFS 根 CID。",

        "form.walletAddressLabel": "FEVM 地址（0x、f410、t410）或 ENS 名称",
        "form.addressPlaceholder": "0x…、f410… 或 name.eth",
        "form.addressHint": "输入 0x、f410 或 t410 地址，或 ENS 名称。ENS 名称在 Ethereum Mainnet 上解析；仅执行公开只读调用。",
        "form.fetchBtn": "查询地址或 ENS",
        "form.networkSwitchLabel": "Filecoin 网络",

        "network.mainnet": "主网",
        "network.calibration": "校准网",

        "app.loadingData": "正在加载数据…",
        "app.resolvingEns": "正在解析 ENS…",
        "app.preparing": "正在准备地址查询…",
        "app.ensName": "ENS 名称",
        "app.resolvingName": "正在 Ethereum Mainnet 上解析 :name…",
        "app.readingDatasets": "正在从 :network 读取数据集并加载 Piece 列表…",
        "app.noDatasets": "未在该地址下找到 FWSS 数据集。",
        "app.requestFailed": "请求失败：:error。请检查 RPC 连接，或确认提供商是否允许浏览器请求（CORS）。",

        "results.emptyState": "输入 FEVM 地址或 ENS 名称以查看其数据集和 Piece。",
        "results.storedDatasets": "已存储的数据集",
        "results.datasetsOne": ":count 个数据集",
        "results.datasetsMany": ":count 个数据集",
        "results.progress": ":label · 加载中，:ready/:total 已就绪 · CAR 根 :rootsDone/:rootsTotal",
        "results.progressLabel": "正在加载数据集和 CAR 根",

        "account.title": "余额与存储运行时间",
        "account.subtitle": "钱包与 Filecoin Pay",
        "account.walletBalances": "钱包余额",
        "account.filBalance": "FIL 余额",
        "account.usdfcBalance": "钱包中的 USDFC",
        "account.filecoinPayStorage": "Filecoin Pay 存储",
        "account.prediction": "预测",
        "account.storageRunway": "存储运行时间",
        "account.totalMonthlyCost": "每月存储总成本",
        "account.monthlyCostTooltip": "当前 Filecoin Pay 活跃支付通道的费率，按每 86,400 个 epoch 计。",
        "account.accountDeposits": "账户存款",
        "account.totalAmount": "总额",
        "account.availableForWithdrawal": "可提取金额",
        "account.amountLocked": "锁定金额",
        "account.payHint": "Filecoin Pay 金额以 USDFC 计价；可用资金不包括被活跃通道锁定的金额。交易手续费需要 FIL。每月存储成本反映活跃通道费率；基于使用量的流量费用和一次性操作费用可能另行变化。",
        "account.loading": "加载中…",
        "account.unavailable": "不可用",

        "unit.usdfcPerMonth": ":value USDFC/月",
        "cost.storageTerminated": "存储已终止",
        "cost.unavailable": "月度成本不可用",

        "format.noStorageSpend": "无活跃存储支出",
        "format.inDeficit": "余额不足 · 需要充值",
        "format.zeroRunway": "0 天 · 需要充值",
        "format.zeroDays": "0 天",
        "format.veryLongRunway": "运行时间非常长",
        "format.durationDays": ":days 天 :hours 小时",
                "format.durationDaysOne": ":days 天 :hours 小时",
                "format.durationHours": ":hours 小时",
                "format.durationHoursOne": ":hours 小时",
                "format.untilApprox": "至约 :date",

                "lookup.emptyInput": "请输入 0x、f410 或 t410 地址，或 ENS 名称。",
                "lookup.invalidAddress": "请输入有效的 0x 地址（40 个十六进制字符）。",
                "lookup.conversionUnavailable": "Filecoin 地址转换不可用。",
                "lookup.invalidFilecoinAddress": "请输入有效的 f410 或 t410 Filecoin 地址。",
                "lookup.resolveFailed": "无法解析该名称。",

        "dataset.title": "数据集：:id",
        "dataset.storageProvider": "存储提供商：:address",
        "dataset.providerEndpoint": "提供商端点：",
        "dataset.paymentRail": "支付通道：",
        "dataset.railTooltip": "在 Filecoin Pay 上打开支付通道",
        "dataset.providerTooltip": "在 PDP Explorer 上打开提供商条目",
        "dataset.checking": "检查中…",
        "dataset.active": "已启用",
        "dataset.inactive": "未启用",
        "dataset.ipfsIndexing": "IPFS 索引",
        "dataset.cdn": "CDN",
        "dataset.piecesLoading": "Pieces：加载中…",
        "dataset.piecesUnavailable": "Pieces：不可用",
        "dataset.sizeAtLeast": "至少 :size",
        "dataset.badge": "Pieces：:count · 大小：:size · 成本：:cost",
        "dataset.badgePartial": "Pieces：:count · 大小：:size · 成本：:cost · 部分",
        "dataset.costTooltip": "当前 Filecoin Pay PDP 通道费率，按每 86,400 个 epoch 计。",
        "dataset.sizeUnknownNoteOne": " 有 :count 个 Piece 的大小不可用。",
        "dataset.sizeUnknownNoteMany": " 有 :count 个 Piece 的大小不可用。",
        "dataset.emptyPieces": "该数据集中没有活跃的 Piece。",
        "dataset.displayLimited": "显示上限为 :count 个 Piece。",
        "dataset.pieceQueryFailed": "Piece 查询失败：:error",

        "piece.sizeUnavailable": "大小不可用",
        "piece.cidLabel": "Piece CID：",
        "piece.copyCid": "将 Piece CID 复制到剪贴板",
        "piece.copyRoot": "将 CAR 根 CID 复制到剪贴板",
        "piece.copyReference": "数据集 :dataset · PieceID :piece",
        "piece.copyInLabel": "副本位于 ",
        "piece.copiesInLabel": "副本位于 ",
        "piece.moreCopies": "（还有 :count 个）",
        "piece.downloadCdn": "从 CDN 下载",
        "piece.downloadProvider": "从存储提供商下载",
        "piece.sourceProvider": "提供商",
        "piece.largeCar": "大型 CAR · :size",
        "piece.largeCarTooltip": "此下载是大小约为 :size 的 CAR 文件。开始前请检查您的网络连接和可用磁盘空间。",
        "piece.rootPending": "CAR 根待处理…",
        "piece.readingHeader": "正在读取 CAR 头…",
        "piece.rootPrefix": "CAR 根：",
        "piece.rootReadFrom": "读取自 :source",
        "piece.rootUnavailable": "CAR 根不可用：:error",
        "piece.openRoot": "在 inbrowser.link 上打开 CAR 根 :root",
        "piece.fileTreeSummary": "加载 UnixFS 文件树",
        "piece.fileTreeLoading": "正在读取 CAR 目录块…",
        "piece.fileTreeUnavailable": "文件树不可用：:error",
        "piece.showNext": "显示接下来 :count 个（还有 :remaining 个）",
        "piece.showAll": "显示全部",

        "ui.copied": "已复制",
        "ui.copyFailed": "复制失败",

        "car.providerSource": "存储提供商",
        "car.cdnSourceFallback": "FilBeam · 提供商不可用",
        "car.noPdpEndpoint": "未注册 PDP 端点",
        "car.cdnDisabled": "未启用 CDN。",
        "car.failureNoCdn": "存储提供商：:provider；:cdn",
        "car.providerThenCdn": "提供商：:provider；CDN：:cdn",
        "car.cdnFailure": "CDN：:error",
        "car.noSources": "没有可用的提供商或 CDN 端点。",
        "car.scanExceeded": "CAR 扫描超过 :size；出于安全考虑已停止显示。",
        "car.noCarStream": "浏览器无法读取 CAR 流。",
        "car.noPieceStream": "浏览器无法读取 Piece 流。",
        "car.onlyCarV1V2": "仅支持 CARv1 和 CARv2。",
        "car.noRoot": "CAR 不包含根 CID。",
        "car.tooManyNodes": "UnixFS 树超过 :count 个节点。",

        "tree.summary": "UnixFS · :source · 已读取 :count 个节点",
        "tree.summaryOne": "UnixFS · :source · 已读取 :count 个节点",
        "tree.dirEntry": ":name/ · 目录",
        "tree.depthLimit": "不显示更深层级。",
        "tree.fileEntry": " · 文件 · :size",
        "tree.kindDirectory": "目录",
        "tree.kindFile": "文件",
        "tree.kindEntry": "UnixFS 条目",
        "tree.kindSymlink": "符号链接",
        "tree.kindMetadata": "元数据",
        "tree.kindMissing": "CAR 中缺少该块",
        "tree.kindUnsupported": "无法识别的 UnixFS 类型",
        "tree.root": "根",
        "tree.rootFile": "根文件",
        "tree.rootNumber": "根 :number",

        "chain.tooManyDatasets": "该账户的数据集超过 :count 个；出于安全考虑已停止。",

        "footer.version": "版本 :version",
        "footer.github": "GitHub",
        "footer.githubTooltip": "在 GitHub 上打开项目",
        "footer.languageLabel": "语言"
    }
};

let currentLanguage;

const listeners = new Set();

export function getAvailableLanguages() {
    return Object.keys(translations);
}

export function getLanguageName(code) {
    return LANGUAGE_NAMES[code] ?? code;
}

// BCP 47 tag used for Intl number and date formatting.
export function localeTag() {
    return LOCALE_TAGS[getCurrentLanguage()] ?? "en-US";
}

export function getCurrentLanguage() {
    if (currentLanguage) return currentLanguage;
    let saved;
    try {
        saved = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    } catch {
        saved = null;
    }
    if (saved && translations[saved]) {
        currentLanguage = saved;
        return saved;
    }
    const browser = typeof navigator === "undefined" ? "" : (navigator.language ?? "").split("-")[0];
    currentLanguage = translations[browser] ? browser : DEFAULT_LANGUAGE;
    return currentLanguage;
}

export function setLanguage(lang) {
    if (!translations[lang]) return getCurrentLanguage();
    currentLanguage = lang;
    try {
        if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        // Storage can be unavailable (private mode); the choice then applies to this page view only.
    }
    if (typeof document !== "undefined") document.documentElement.lang = lang;
    for (const listener of [...listeners]) listener(lang);
    return lang;
}

export function onLanguageChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// Returns the translation for `key` with `:name` placeholders replaced by params.
// Falls back to English, then to `[[key]]` for unknown keys.
export function t(key, params = {}) {
    const lang = getCurrentLanguage();
    const value = translations[lang]?.[key] ?? translations[DEFAULT_LANGUAGE][key];
    if (value === undefined) return `[[${key}]]`;
    let text = value;
    for (const [name, replacement] of Object.entries(params)) {
        text = text.split(`:${name}`).join(String(replacement));
    }
    return text;
}

// Error whose message can be re-translated after a language change: `render` returns the current text
// and the UI reads `messageRender` instead of the (frozen) `message`.
export function translatedError(render) {
    const error = new Error(render());
    error.messageRender = render;
    return error;
}

// Text of an error as it should be shown now, honouring `messageRender` when present.
export function errorText(error) {
    return error?.messageRender ? error.messageRender() : String(error?.message ?? error);
}