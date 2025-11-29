export type Species =
  | "haploblepharus_edwardsii"
  | "haploblepharus_pictus"
  | "haploblepharus_fuscus"
  | "poroderma_africanum"
  | "poroderma_pantherinum"
  | "triakis_megalopterus"
  | "halaelurus_natalensis"

interface SpeciesInfo {
  scientificName: string
  commonName: string
}

export const species: Record<Species, SpeciesInfo> = {
  haploblepharus_edwardsii: {
    scientificName: "Haploblepharus edwardsii",
    commonName: "Puffadder shyshark",
  },
  haploblepharus_fuscus: {
    scientificName: "Haploblepharus fuscus",
    commonName: "Brown shyshark",
  },
  haploblepharus_pictus: {
    scientificName: "Haploblepharus pictus",
    commonName: "Dark shyshark",
  },
  poroderma_africanum: {
    scientificName: "Poroderma africanum",
    commonName: "Pyjama catshark",
  },
  poroderma_pantherinum: {
    scientificName: "Poroderm pantherinum",
    commonName: "Leopard catshark",
  },
  triakis_megalopterus: {
    scientificName: "Triakis megalopterus",
    commonName: "Spotted gully shark",
  },
  halaelurus_natalensis: {
    scientificName: "Halaelurus natalensis",
    commonName: "Tiger catshark",
  },
}

export function toAcronym(scientificName: string) {
  return scientificName
    .split(" ")
    .map((word) => word[0].toUpperCase())
    .join("")
}

export function toAbbreviated(scientificName: string) {
  return (
    scientificName.charAt(0) +
    ". " +
    scientificName.split(" ").toSpliced(0, 1).join(" ")
  )
}
