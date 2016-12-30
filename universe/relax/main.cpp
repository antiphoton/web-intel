#include<math.h>
#include<mpi.h>
#include<sys/ipc.h>
#include<sys/shm.h>
#define for if (0) ; else for
const double TIMESTEP = 0.01;
struct Point {
    double x, y;
    void set(double x, double y) {
        this->x = x;
        this->y = y;
    }
    void copy(const Point &that) {
        x = that.x;
        y = that.y;
    }
};
int mpiSize, mpiRank;
void * myAlloc (int size) {
    int shmid;
    if (mpiRank == 0) {
        shmid = shmget(0, size, IPC_CREAT | 0666);
    }
    MPI_Bcast(&shmid, 1, MPI_INT, 0, MPI_COMM_WORLD);
    void * p = shmat(shmid, NULL, 0);
    return p;
}
Point boundary;
namespace Star {
    int n;
    Point *previousLocation;
    Point *location;
    double *forceX, *forceY;
    int * head;
};
namespace Gate {
    int m;
    int * level;
    int * endpoint1;
    int * endpoint2;
    int offset;
    int * dest;
    int * next;
};
void addEdge (int s, int t) {
    Gate::dest[Gate::offset] = t;
    Gate::next[Gate::offset] = Star::head[s];
    Star::head[s] = Gate::offset;
    Gate::offset++;
}
void readUniverse (const char *filename) {
    FILE * f = 0;
    double xMin, xMax, yMin, yMax;
    if (mpiRank == 0) {
        f = fopen(filename, "r");
        fscanf(f, "%lf%lf%lf%lf", &xMin, &xMax, &yMin, &yMax);
        boundary.x = xMax - xMin;
        boundary.y = yMax - yMin;
        fscanf(f, "%d", &Star::n);
    }
    MPI_Bcast(&Star::n, 1, MPI_INT, 0, MPI_COMM_WORLD);
    Star::previousLocation = (Point *)myAlloc(sizeof(Point) * Star::n);
    Star::location = (Point *)myAlloc(sizeof(Point) * Star::n);
    Star::forceX = new double[Star::n];
    Star::forceY = new double[Star::n];
    if (mpiRank == 0) {
        for (int i = 0; i < Star::n; i++) {
            double x, y;
            fscanf(f, "%lf%lf", &x, &y);
            x -= xMin;
            y -= yMin;
            Star::previousLocation[i].set(x, y);
            Star::location[i].set(x, y);
        }
        fscanf(f, "%d", &Gate::m);
    }
    MPI_Bcast(&Gate::m, 1, MPI_INT, 0, MPI_COMM_WORLD);
    Gate::level = new int[Gate::m];
    Gate::endpoint1 = new int[Gate::m];
    Gate::endpoint2 = new int[Gate::m];
    if (mpiRank == 0) {
        for (int i = 0; i < Gate::m; i++) {
            int t, a, b;
            fscanf(f, "%d%d%d", &t, &a, &b);
            Gate::level[i] = t;
            Gate::endpoint1[i] = a;
            Gate::endpoint2[i] = b;
        }
    }
    MPI_Bcast(Gate::level, Gate::m, MPI_INT, 0, MPI_COMM_WORLD);
    MPI_Bcast(Gate::endpoint1, Gate::m, MPI_INT, 0, MPI_COMM_WORLD);
    MPI_Bcast(Gate::endpoint2, Gate::m, MPI_INT, 0, MPI_COMM_WORLD);
    Gate::offset = 0;
    Star::head = new int[Star::n];
    Gate::dest = new int[Gate::m * 2];
    Gate::next = new int[Gate::m * 2];
    for (int i = 0; i < Star::n; i++) {
        Star::head[i] = -1;
    }
    for (int i = 0; i < Gate::m; i++) {
        int a, b;
        a = Gate::endpoint1[i];
        b = Gate::endpoint2[i];
        addEdge(a, b);
        addEdge(b, a);
    }
}
void interact () {
    for (int i = 0; i < Star::n; i++) {
        Star::forceX[i] = 0;
        Star::forceY[i] = 0;
    }
    for (int i = mpiRank; i < Star::n; i += mpiSize) {
        double x1 = Star::location[i].x;
        double y1 = Star::location[i].y;
        for (int j = i + 1; j < Star::n; j++) {
            double fx = 0, fy = 0;// from 1, acting on 2
            double x2 = Star::location[j].x;
            double y2 = Star::location[j].y;
            double xDel = x2 - x1;
            double yDel = y2 - y1;
            double rSqr = xDel * xDel + yDel * yDel;
            double r = sqrt(rSqr);
            if (r <= 1) {//eclusion
                double f = (1 - r) * (1 - r);
                fx += f * xDel / r;
                fy += f * yDel / r;
            }
            Star::forceX[j] += fx;
            Star::forceY[j] += fy;
            Star::forceX[i] -= fx;
            Star::forceY[i] -= fy;
        }
    }
    for (int i = mpiRank; i < Gate::m; i += mpiSize) {
        int v1 = Gate::endpoint1[i];
        int v2 = Gate::endpoint2[i];
        double fx = 0, fy = 0;// from 1, acting on 2
        double x1 = Star::location[v1].x;
        double y1 = Star::location[v1].y;
        double x2 = Star::location[v2].x;
        double y2 = Star::location[v2].y;
        double xDel = x2 - x1;
        double yDel = y2 - y1;
        double rSqr = xDel * xDel + yDel * yDel;
        double r = sqrt(rSqr);
        if (1) {
            double f = 0;
            switch (Gate::level[i]) {
                case 0:
                    if (r > 1) {
                        f = 1;
                    }
                    break;
                case 1:
                    if (r > 2) {
                        f = 1;
                    }
                    break;
                case 2:
                    if (r > 5) {
                        f = 1;
                    }
                    break;
            }
            fx += - f * xDel / r;
            fy += - f * yDel / r;
        }
        Star::forceX[v2] += fx;
        Star::forceY[v2] += fy;
        Star::forceX[v1] -= fx;
        Star::forceY[v1] -= fy;
    }
    MPI_Allreduce(MPI_IN_PLACE, Star::forceX, Star::n, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);
    MPI_Allreduce(MPI_IN_PLACE, Star::forceY, Star::n, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);
}
void fix (double averageSpeed) {
    double s = 0;
    for (int i = mpiRank; i < Star::n; i += mpiSize) {
        double dx = Star::location[i].x - Star::previousLocation[i].x;
        double dy = Star::location[i].y - Star::previousLocation[i].y;
        s += dx * dx + dy * dy;
    }
    double s0;
    MPI_Reduce(&s, &s0, 1, MPI_DOUBLE, MPI_SUM, 0, MPI_COMM_WORLD);
    static double chi = 0;
    if (mpiRank == 0) {
        const double TAU = TIMESTEP * 10;
        chi += (1 / TAU / TAU * (s0 / averageSpeed / averageSpeed - 1)) * TIMESTEP;
    }
    MPI_Bcast(&chi, 1, MPI_DOUBLE, 0, MPI_COMM_WORLD);
    for (int i = mpiRank; i < Star::n; i += mpiSize) {
        double dx = Star::location[i].x - Star::previousLocation[i].x;
        double dy = Star::location[i].y - Star::previousLocation[i].y;
        Star::forceX[i] -= chi * dx / TIMESTEP;
        Star::forceY[i] -= chi * dy / TIMESTEP;
    }
}
void integrate () {
    const double LIMIT = 1;
    for (int i = mpiRank; i < Star::n; i += mpiSize) {
        double fx, fy;
        fx = Star::forceX[i];
        fy = Star::forceY[i];
        double fSqr = fx * fx + fy * fy;
        if (fSqr > LIMIT * LIMIT) {
            double k = LIMIT / sqrt(fSqr);
            fx *= k;
            fy *= k;
        }
        double x, y;
        x = Star::location[i].x * 2 - Star::previousLocation[i].x;
        y = Star::location[i].y * 2 - Star::previousLocation[i].y;
        x += fx * TIMESTEP * TIMESTEP;
        y += fy * TIMESTEP * TIMESTEP;
        Star::previousLocation[i].copy(Star::location[i]);
        Star::location[i].set(x, y);
    }
    MPI_Barrier(MPI_COMM_WORLD);
}
void printThermal (int t) {
    if (mpiRank == 0) {
        printf("%d\n", t);
    }
}
void dump (FILE * f, int t) {
    MPI_Barrier(MPI_COMM_WORLD);
    if (mpiRank == 0) {
        fprintf(f, "%d %d\n", t, Star::n);
        for (int i = 0; i < Star::n; i++) {
            fprintf(f, "%f %f\n", Star::location[i].x, Star::location[i].y);
        }
        fflush(f);
    }
};
int main (int argc, char ** argv) {
    MPI_Init(&argc, &argv);
    MPI_Comm_size(MPI_COMM_WORLD, &mpiSize);
    MPI_Comm_rank(MPI_COMM_WORLD, &mpiRank);
    readUniverse("../filter/data.txt");
    FILE * f =fopen("./data.txt", "w");
    const int TOTAL_STEP = 10000;
    const int OUTPUT_LINES = 100000;
    const int DUMP_EVERY = ceil(1.0 * TOTAL_STEP * Star::n / OUTPUT_LINES);
    const int THERMAL_EVERY = ceil(1000000000.0 / Star::n / Star::n);
    for (int t = 0; t < TOTAL_STEP; t++) {
        interact();
        double remaining = 1.0 * (TOTAL_STEP - t) / TOTAL_STEP;
        fix(0.1 * remaining * remaining);
        integrate();
        if (t % THERMAL_EVERY == 0) {
            printThermal(t);
        }
        if (t % DUMP_EVERY  == 0) {
            dump(f, t);
        }
    }
    MPI_Finalize();
    return 0;
}

