import TopBar from '../../components/TopBar';
import Panel from '../../components/Panel';
import RestaurantMap from '../../components/RestaurantMap';
import { restaurants } from '../../data/restaurants';

export default function AdminRestaurants() {
  return (
    <>
      <TopBar
        title="Restaurant Map"
        subtitle={`${restaurants.length} restaurants plotted across Hyderabad Zone`}
      />
      <div className="content">
        <Panel title="All Restaurants">
          <RestaurantMap restaurants={restaurants} />
        </Panel>
      </div>
    </>
  );
}