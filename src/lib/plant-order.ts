import AsyncStorage from "@react-native-async-storage/async-storage";
import { isPlantOrder, type PlantOrder } from "@/domain/plant-order";

const PLANT_ORDER_KEY = "plantOrder";

/** How this phone lists the greenhouse. Needs-first until the keeper says otherwise. */
export async function getPlantOrder(): Promise<PlantOrder> {
  try {
    const stored = await AsyncStorage.getItem(PLANT_ORDER_KEY);
    return isPlantOrder(stored) ? stored : "needs";
  } catch {
    return "needs";
  }
}

export async function setPlantOrder(order: PlantOrder): Promise<void> {
  try {
    await AsyncStorage.setItem(PLANT_ORDER_KEY, order);
  } catch {
    // Not remembered on this phone; the list still changes for now.
  }
}
