from app.seed import seed
from app.seed2 import seed2

if __name__ == "__main__":
    seed()
    seed2()
    print("Database initialised with demo data.")
